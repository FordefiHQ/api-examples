import * as kit from '@solana/kit';
import { fordefiConfig } from '../config';
import { signWithFordefi } from '../signers';
import { createClient } from "./solana-client-util";
import * as loader from '@solana-program/loader-v3';

// this is a utility script to close buffers in case of a failed deployment
// buffer address to close - pass as command line argument or hardcode here
const BUFFER_ADDRESS = process.argv[2] || 'BuffbyuYr2CGVAC5LZjPhzxfLGdmaa7Qf6tgph2KRjKe';

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken) {
    console.error('Error: FORDEFI_API_TOKEN environment variable is not set');
    return;
  }

  console.log(`Closing buffer account: ${BUFFER_ADDRESS}`);
  console.log(`Reclaiming lamports to: ${fordefiConfig.deployerVaultAddress}`);

  const solana_client = await createClient();
  const deployerVault = kit.address(fordefiConfig.deployerVaultAddress);
  const deployerVaultSigner = kit.createNoopSigner(deployerVault);

  // Check buffer account exists and get its balance
  const bufferAddress = kit.address(BUFFER_ADDRESS);
  const accountInfo = await solana_client.rpc.getAccountInfo(bufferAddress, { encoding: 'base64' }).send();

  if (!accountInfo.value) {
    console.error(`Buffer account ${BUFFER_ADDRESS} does not exist`);
    return;
  }

  const lamports = accountInfo.value.lamports;
  console.log(`Buffer balance: ${Number(lamports) / 1e9} SOL`);

  const closeIx = loader.getCloseInstruction({
    bufferOrProgramDataAccount: bufferAddress,
    destinationAccount: deployerVault,
    authority: deployerVaultSigner,
  });

  const message = kit.pipe(
    kit.createTransactionMessage({ version: 0 }),
    msg => kit.setTransactionMessageFeePayerSigner(deployerVaultSigner, msg),
    msg => kit.appendTransactionMessageInstructions([closeIx], msg),
  );

  console.log('Signing transaction with Fordefi...');
  const rawSignedTxBase64 = await signWithFordefi(message, solana_client.rpc);
  console.log('Transaction signed');

  console.log('Broadcasting transaction...');
  const txSignature = await solana_client.rpc.sendTransaction(
    rawSignedTxBase64 as kit.Base64EncodedWireTransaction,
    {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      encoding: 'base64'
    }
  ).send();

  console.log(`Transaction sent: ${txSignature}`);
  console.log(`Reclaimed ~${Number(lamports) / 1e9} SOL`);
}

main().catch(console.error);
