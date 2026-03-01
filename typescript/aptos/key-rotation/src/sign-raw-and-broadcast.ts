import {
  Aptos,
  AptosConfig,
  AccountAddress,
  Ed25519PublicKey,
  Ed25519PrivateKey,
  Ed25519Signature,
  Account,
  U8,
  MoveVector,
} from "@aptos-labs/ts-sdk";
import { RotationProofChallenge } from "@aptos-labs/ts-sdk";
import { createAndSignTx, get_tx } from "./process_tx";
import { signWithPrivateKey } from "./signer";
import { fordefiConfig, FordefiAptosConfig, APTOS_NETWORK } from "./config";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);

export async function signRawPayload(
  rawBytes: Uint8Array,
  fordefiCfg: FordefiAptosConfig
): Promise<Buffer> {
  const base64Payload = Buffer.from(rawBytes).toString("base64");

  const payload = {
    vault_id: fordefiCfg.fordefiVaultID,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "black_box_signature",
    details: {
      format: "hash_binary",
      hash_binary: base64Payload,
    },
  };

  const requestBody = JSON.stringify(payload);
  const timestamp = new Date().getTime();
  const requestPayload = `${fordefiCfg.apiPathEndpoint}|${timestamp}|${requestBody}`;
  const signedPayload = await signWithPrivateKey(requestPayload, fordefiCfg.privateKeyPem);

  console.log("Submitting raw payload to Fordefi for signature...");
  const response = await createAndSignTx(
    fordefiCfg.apiPathEndpoint,
    fordefiCfg.accessToken,
    signedPayload,
    timestamp,
    requestBody
  );

  const fordefiTxId = response.data.id;
  console.log(`Fordefi transaction ID: ${fordefiTxId}`);

  const signature = await pollForSignature(fordefiTxId, fordefiCfg);
  return signature;
}

async function pollForSignature(
  txId: string,
  fordefiCfg: FordefiAptosConfig,
  maxAttempts: number = 10,
  intervalMs: number = 2000
): Promise<Buffer> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tx = await get_tx(fordefiCfg.apiPathEndpoint, fordefiCfg.accessToken, txId);

    if (tx.state === "completed") {
      const signatureBase64 = tx.details.signature;
      console.log("Signature received from Fordefi");
      return Buffer.from(signatureBase64, "base64");
    }

    if (tx.state === "failed" || tx.state === "aborted") {
      throw new Error(`Fordefi transaction ${tx.state}: ${JSON.stringify(tx)}`);
    }

    console.log(`Waiting for signature... (attempt ${attempt}/${maxAttempts}, state: ${tx.state})`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for Fordefi signature after ${maxAttempts} attempts`);
}

async function fetchPublicKeyFromFordefiVault(
  vaultId: string,
  accessToken: string
): Promise<Ed25519PublicKey> {
  const url = `https://api.fordefi.com/api/v1/vaults/${vaultId}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const publicKeyBase64 = response.data.public_key_compressed;
  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");
  console.log(`Public key from vault (hex): 0x${publicKeyBytes.toString("hex")}`);

  return new Ed25519PublicKey(publicKeyBytes);
}

async function main(): Promise<void> {
  // Load the current (Petra/external) private key from .env
  const petraPrivateKeyHex = process.env.PETRA_PRIVATE_KEY;
  if (!petraPrivateKeyHex) {
    throw new Error("PETRA_PRIVATE_KEY must be set in .env (hex-encoded Ed25519 private key)");
  }

  const currentPrivateKey = new Ed25519PrivateKey(petraPrivateKeyHex);
  const currentAccount = Account.fromPrivateKey({ privateKey: currentPrivateKey, legacy: true });
  const accountAddress = currentAccount.accountAddress.toString();

  console.log(`Account to rotate: ${accountAddress}`);

  const accountInfo = await aptos.account.getAccountInfo({ accountAddress });
  const sequenceNumber = BigInt(accountInfo.sequence_number);
  const currentAuthKey = AccountAddress.from(accountInfo.authentication_key);
  console.log(`Sequence number: ${sequenceNumber}`);
  console.log(`Current auth key: ${currentAuthKey.toString()}`);

  const newPublicKey = await fetchPublicKeyFromFordefiVault(
    fordefiConfig.fordefiVaultID,
    fordefiConfig.accessToken
  );

  const challenge = new RotationProofChallenge({
    sequenceNumber,
    originator: currentAccount.accountAddress,
    currentAuthKey,
    newPublicKey,
  });

  const challengeBytes = challenge.bcsToBytes();
  console.log(`\nRotationProofChallenge serialized (${challengeBytes.length} bytes)`);

  console.log("Signing challenge with external key (Petra)...");
  const currentKeyProof = currentPrivateKey.sign(challengeBytes);

  console.log("Signing challenge with new key (Fordefi Balck Box vault)...");
  const newKeyProofBytes = await signRawPayload(challengeBytes, fordefiConfig);
  const newKeyProof = new Ed25519Signature(newKeyProofBytes);

  console.log("\nBuilding rotation transaction...");
  const transaction = await aptos.transaction.build.simple({
    sender: currentAccount.accountAddress,
    data: {
      function: "0x1::account::rotate_authentication_key",
      functionArguments: [
        new U8(0), // from_scheme: Ed25519
        MoveVector.U8(currentAccount.publicKey.toUint8Array()),
        new U8(0), // to_scheme: Ed25519
        MoveVector.U8(newPublicKey.toUint8Array()),
        MoveVector.U8(currentKeyProof.toUint8Array()),
        MoveVector.U8(newKeyProof.toUint8Array()),
      ],
    },
  });

  console.log("Submitting rotation transaction to Aptos...");
  const pendingTx = await aptos.signAndSubmitTransaction({
    signer: currentAccount,
    transaction,
  });

  console.log(`Transaction submitted: ${pendingTx.hash}`);

  await aptos.waitForTransaction({
    transactionHash: pendingTx.hash,
  });

  console.log("\nKey rotation completed successfully!");
  console.log(`Transaction hash: ${pendingTx.hash}`);
  console.log(`New auth key (Fordefi vault): 0x${Buffer.from(newPublicKey.toUint8Array()).toString("hex")}`);
  console.log(`View on explorer: https://explorer.aptoslabs.com/txn/${pendingTx.hash}?network=mainnet`);
}

main().catch((error) => {
  console.error("Unhandled error:", error);
});
