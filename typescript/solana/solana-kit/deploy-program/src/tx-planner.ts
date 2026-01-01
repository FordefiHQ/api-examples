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

    const ixs = [];

    // create buffer account and initialize buffer
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
    ixs.push(createBuffer, initBuffer)

    // write to buffer in chunks
    // max tx size is 1232 bytes, need room for header, signatures, accounts, etc.
    const writeBufferIxs = [];
    const chunkSize = 900;
    let offset = 0;
    while (offset < dataSize.length) {
      const chunk = dataSize.slice(offset, offset + chunkSize);
      writeBufferIxs.push(
        loader.getWriteInstruction({
          bufferAccount: bufferSigner.address,
          bufferAuthority: deployerVaultSigner,
          offset,
          bytes: chunk,
        })
      );
      offset += chunkSize;
    }
    ixs.push(...writeBufferIxs);

    // deploy the buffer to a program
    const maxDataLen = dataSize.length + 10000;    // we add some extra buffer for future upgrades
    const PROGRAM_ACCOUNT_SIZE = 36;
    const programAccountRent = await client.rpc.getMinimumBalanceForRentExemption(BigInt(PROGRAM_ACCOUNT_SIZE)).send();
    console.log(`Program account rent: ${Number(programAccountRent) / 1e9} SOL for ${PROGRAM_ACCOUNT_SIZE} bytes`);

    const [programDataAddress] = await kit.getProgramDerivedAddress({
      programAddress: kit.address(loader.LOADER_V3_PROGRAM_ADDRESS),
      seeds: [kit.getAddressEncoder().encode(programSigner.address)],
    });

    // create program account
    const createProgramAccount = system.getCreateAccountInstruction({
      newAccount: programSigner,
      payer: deployerVaultSigner,
      programAddress: loader.LOADER_V3_PROGRAM_ADDRESS,
      space: PROGRAM_ACCOUNT_SIZE,
      lamports: programAccountRent,
    });

    // deploy the program
    const deployInstruction = loader.getDeployWithMaxDataLenInstruction({
      authority: deployerVaultSigner,
      bufferAccount: bufferSigner.address,
      payerAccount: deployerVaultSigner,
      programDataAccount: programDataAddress,
      programAccount: programSigner.address,
      maxDataLen,
    });
    ixs.push(createProgramAccount, deployInstruction);

    // put plan together
    console.log(`Program ID: ${programSigner.address}`);
    console.log(`Buffer account: ${bufferSigner.address}`);
    const instructionPlan = kit.sequentialInstructionPlan(ixs);

    // note we don't add a blockhash yet, we'll add it when signing with Fordefi
    const transactionPlanner = kit.createTransactionPlanner({
        createTransactionMessage: () =>
            kit.pipe(
                kit.createTransactionMessage({ version: 0 }),
                msg => kit.setTransactionMessageFeePayerSigner(deployerVaultSigner, msg),
            ),
    });

    const transactionPlan = await transactionPlanner(instructionPlan);

    return transactionPlan;
}
