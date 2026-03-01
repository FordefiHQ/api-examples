import { createAndSignTx } from './process_tx';
import { signWithPrivateKey } from './signer';
import { buildAptTransferPayload } from './bb-serializer';
import { fetchAndBroadcastTransaction } from './broadcast-aptos-transaction';
import { fordefiConfig } from './config';
import { Ed25519PublicKey } from '@aptos-labs/ts-sdk';
import axios from 'axios';

async function fetchPublicKeyFromVault(vaultId: string, accessToken: string): Promise<Ed25519PublicKey> {
  const url = `https://api.fordefi.com/api/v1/vaults/${vaultId}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const publicKeyBase64 = response.data.public_key_compressed;
  const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
  console.log(`Public key from vault (hex): 0x${publicKeyBytes.toString('hex')}`);

  return new Ed25519PublicKey(publicKeyBytes);
}

async function main(): Promise<void> {
  // Build transaction payload
  const { payload, transaction } = await buildAptTransferPayload(fordefiConfig);
  const requestBody = JSON.stringify(payload);
  const timestamp = new Date().getTime();
  const requestPayload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signedPayload = await signWithPrivateKey(requestPayload, fordefiConfig.privateKeyPem);

  console.log("Submitting transaction to Fordefi for signature 🔑")
  const response = await createAndSignTx(
    fordefiConfig.apiPathEndpoint,
    fordefiConfig.accessToken,
    signedPayload,
    timestamp,
    requestBody
  );

  const fordefiTxId = response.data.id;
  console.log(`Fordefi transaction ID: ${fordefiTxId}`);

  // Wait for signature
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Fetch public key from Fordefi vault
  console.log("\nFetching public key from vault...");
  const publicKey = await fetchPublicKeyFromVault(fordefiConfig.fordefiVaultID, fordefiConfig.accessToken);

  // Fetch signature and broadcast to Aptos
  console.log("\nFetching signature and broadcasting to Aptos...");
  const result = await fetchAndBroadcastTransaction(
    transaction,
    publicKey,
    fordefiTxId,
    fordefiConfig.accessToken,
    fordefiConfig.apiPathEndpoint
  );

  console.log("\n✅ Transaction completed successfully!");
  console.log(`Aptos transaction hash: ${result.hash}`);
  console.log(`View on explorer: https://explorer.aptoslabs.com/txn/${result.hash}?network=mainnet`);
}

main().catch(error => {
    console.error("Unhandled error:", error);
});