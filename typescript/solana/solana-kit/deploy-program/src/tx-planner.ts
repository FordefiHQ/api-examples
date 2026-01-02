import fs from 'fs';
import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './config';
import { Client } from './utils/solana-client-util';
import * as system from '@solana-program/system';
import * as loader from '@solana-program/loader-v3';


export async function createTxPlan(fordefiConfig: FordefiSolanaConfig, client: Client) {
    const deployerVault = kit.address(fordefiConfig.deployerVaultAddress);
    const deployerVaultSigner = kit.createNoopSigner(deployerVault);

    // Load buffer account keypair
    const bufferKeypairBytes = new Uint8Array(JSON.parse(fs.readFileSync(fordefiConfig.bufferKeypairPath, 'utf-8')));
    const bufferSigner = await kit.createKeyPairSignerFromBytes(bufferKeypairBytes);

    // Load program keypair (the program ID)
    const programKeypairBytes = new Uint8Array(JSON.parse(fs.readFileSync(fordefiConfig.programKeypairPath, 'utf-8')));
    const programSigner = await kit.createKeyPairSignerFromBytes(programKeypairBytes);

    const dataSize = new Uint8Array(fs.readFileSync(fordefiConfig.programBinaryPath))
    console.log(`Data size: ${dataSize.length}`)

    const bufferSize = dataSize.length+37; // 37 is the Buffer header size
    const lamports = await client.rpc.getMinimumBalanceForRentExemption(BigInt(bufferSize)).send();
    console.log(`Buffer rent: ${Number(lamports) / 1e9} SOL for ${bufferSize} bytes`);

    // create buffer account and initialize buffer
    const initBufferIxs = [];
    const createBuffer = 
      system.getCreateAccountInstruction({
        payer: deployerVaultSigner,
        newAccount: bufferSigner,
        lamports,
        space: bufferSize,
        programAddress: kit.address(loader.LOADER_V3_PROGRAM_ADDRESS),
      })
    const initBuffer =
      loader.getInitializeBufferInstruction({
        bufferAuthority: deployerVault,
        sourceAccount: bufferSigner.address
      })
    initBufferIxs.push(createBuffer, initBuffer)

    // write to buffer using linear message packer
    const writeIxs = [];
    const programData = dataSize;
    const payer = deployerVaultSigner;
    const MAX_CHUNK_SIZE = 900; // limit chink size to avoid errors in Fordefi
    const writeBufferIx = kit.getLinearMessagePackerInstructionPlan({
      totalLength: programData.length,
      getInstruction: (offset, length) => {
        const clampedLength = Math.min(length, MAX_CHUNK_SIZE);
        return loader.getWriteInstruction({
          bufferAccount: bufferSigner.address,
          bufferAuthority: payer,
          offset: offset,
          bytes: programData.subarray(offset, offset + clampedLength),
        });
      }
    });
    writeIxs.push(writeBufferIx);

    // deploy the buffer to a program
    const maxDataLen = dataSize.length + 10000;    // we add some extra buffer for future upgrades
    const PROGRAM_ACCOUNT_SIZE = 36;
    const programAccountRent = await client.rpc.getMinimumBalanceForRentExemption(BigInt(PROGRAM_ACCOUNT_SIZE)).send();
    console.log(`Program account rent: ${Number(programAccountRent) / 1e9} SOL for ${PROGRAM_ACCOUNT_SIZE} bytes`);

    const [programDataAddress] = await kit.getProgramDerivedAddress({
      programAddress: kit.address(loader.LOADER_V3_PROGRAM_ADDRESS),
      seeds: [kit.getAddressEncoder().encode(programSigner.address)],
    });

    // create and deploy program account
    const deployIxs = [];
    const createProgramAccount = system.getCreateAccountInstruction({
      newAccount: programSigner,
      payer: deployerVaultSigner,
      programAddress: loader.LOADER_V3_PROGRAM_ADDRESS,
      space: PROGRAM_ACCOUNT_SIZE,
      lamports: programAccountRent,
    });
    const deployInstruction = loader.getDeployWithMaxDataLenInstruction({
      authority: deployerVaultSigner,
      bufferAccount: bufferSigner.address,
      payerAccount: deployerVaultSigner,
      programDataAccount: programDataAddress,
      programAccount: programSigner.address,
      maxDataLen,
    });
    deployIxs.push(createProgramAccount, deployInstruction);

    // put plan together
    console.log(`Program ID: ${programSigner.address}`);
    console.log(`Buffer account: ${bufferSigner.address}`);
    const bufferPlan = kit.sequentialInstructionPlan(initBufferIxs);
    const writeBufferPlan = kit.sequentialInstructionPlan(writeIxs); // you can also use a kit.parallelInstructionPlan to speed writes if your custom RPC has high rate-limits
    const deployPlan = kit.sequentialInstructionPlan(deployIxs);
    const masterPlan = kit.sequentialInstructionPlan([bufferPlan, writeBufferPlan, deployPlan])

    // note we don't add a blockhash yet, we'll add it when signing with Fordefi
    const transactionPlanner = kit.createTransactionPlanner({
        createTransactionMessage: () =>
            kit.pipe(
                kit.createTransactionMessage({ version: 0 }),
                msg => kit.setTransactionMessageFeePayerSigner(deployerVaultSigner, msg),
            ),
    });

    const transactionPlan = await transactionPlanner(masterPlan);

    return transactionPlan;
}
