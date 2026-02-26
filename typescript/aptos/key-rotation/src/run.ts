import {
  Aptos,
  AptosConfig,
  AccountAddress,
  Ed25519PrivateKey,
  SigningSchemeInput,
} from "@aptos-labs/ts-sdk";
import { fordefiConfig, rotationConfig, APTOS_NETWORK } from "./config";
import { buildRotationChallenge } from "./rotation/challenge";
import { signWithOldKey, signWithFordefi } from "./rotation/signers";
import { buildRotateAuthKeyPayload } from "./rotation/tx";
import { createAndSignTx, get_tx } from "./process_tx";
import { signWithPrivateKey } from "./signer";

async function main(): Promise<void> {
  const aptos = new Aptos(new AptosConfig({ network: APTOS_NETWORK }));

  // ── 1. Fetch deployer account info ──────────────────────────────────
  const deployerAddr = AccountAddress.from(rotationConfig.deployerAddress);
  const accountInfo = await aptos.account.getAccountInfo({
    accountAddress: deployerAddr,
  });
  const sequenceNumber = BigInt(accountInfo.sequence_number);
  const currentAuthKey = AccountAddress.from(accountInfo.authentication_key);

  console.log(`Deployer: ${deployerAddr.toString()}`);
  console.log(`Sequence number: ${sequenceNumber}`);
  console.log(`Current auth key: ${currentAuthKey.toString()}`);

  // ── 2. Derive public keys ──────────────────────────────────────────
  const oldPrivateKey = new Ed25519PrivateKey(
    rotationConfig.deployerPrivateKeyHex
  );
  const oldPublicKey = oldPrivateKey.publicKey();

  // Fetch Fordefi vault's public key from the vault address
  const fordefiAddr = AccountAddress.from(rotationConfig.fordefiVaultAddress);
  const fordefiAccountInfo = await aptos.account.getAccountInfo({
    accountAddress: fordefiAddr,
  });
  const newPublicKeyHex = fordefiAccountInfo.authentication_key;
  const newPublicKeyBytes = AccountAddress.from(newPublicKeyHex).toUint8Array();

  console.log(`Old public key: ${oldPublicKey.toString()}`);
  console.log(`New public key (Fordefi vault): 0x${Buffer.from(newPublicKeyBytes).toString("hex")}`);

  // ── 3. Build RotationProofChallenge bytes ──────────────────────────
  const challengeBytes = buildRotationChallenge({
    sequenceNumber,
    originator: deployerAddr,
    currentAuthKey,
    newPublicKeyBytes,
  });

  console.log(
    `Challenge bytes (${challengeBytes.length} bytes): 0x${Buffer.from(challengeBytes).toString("hex")}`
  );

  // ── 4. Sign challenge with both keys ───────────────────────────────
  console.log("\nSigning challenge with deployer (old) key...");
  const oldKeySignature = signWithOldKey(
    challengeBytes,
    rotationConfig.deployerPrivateKeyHex
  );
  console.log(`Old key signature: 0x${Buffer.from(oldKeySignature).toString("hex")}`);

  console.log("\nSigning challenge with Fordefi vault (new) key...");
  const newKeySignature = await signWithFordefi(
    challengeBytes,
    fordefiConfig,
    rotationConfig.fordefiVaultId
  );
  console.log(`New key signature: 0x${Buffer.from(newKeySignature).toString("hex")}`);

  // ── 5. Build rotation transaction payload ──────────────────────────
  const rotationPayload = buildRotateAuthKeyPayload({
    fromScheme: SigningSchemeInput.Ed25519,
    fromPublicKey: oldPublicKey.toUint8Array(),
    toScheme: SigningSchemeInput.Ed25519,
    toPublicKey: newPublicKeyBytes,
    proofSignedByCurrentKey: oldKeySignature,
    proofSignedByNewKey: newKeySignature,
  });

  // ── 6. Build Aptos transaction and serialize for Fordefi ───────────
  const transaction = await aptos.transaction.build.simple({
    sender: deployerAddr,
    data: rotationPayload,
  });

  // Simulate first
  const [simResult] = await aptos.transaction.simulate.simple({
    transaction,
  });
  if (!simResult?.success) {
    throw new Error(`Simulation failed: ${simResult?.vm_status ?? "unknown"}`);
  }
  console.log("\nSimulation successful");

  // Serialize and submit via Fordefi
  const txBytes = transaction.rawTransaction.bcsToBytes();
  const base64Tx = Buffer.from(txBytes).toString("base64");

  const fordefiRequestBody = JSON.stringify({
    vault_id: rotationConfig.fordefiVaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "aptos_transaction",
    details: {
      type: "aptos_serialized_entry_point_payload",
      chain: APTOS_NETWORK === "mainnet" ? "aptos_mainnet" : "aptos_testnet",
      serialized_transaction_payload: base64Tx,
      push_mode: "auto",
    },
  });

  const timestamp = new Date().getTime();
  const apiPayload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${fordefiRequestBody}`;
  const apiSignature = await signWithPrivateKey(
    apiPayload,
    fordefiConfig.privateKeyPem
  );

  console.log("\nSubmitting rotation transaction to Fordefi...");
  const response = await createAndSignTx(
    fordefiConfig.apiPathEndpoint,
    fordefiConfig.accessToken,
    apiSignature,
    timestamp,
    fordefiRequestBody
  );

  const signedTx = await get_tx(
    fordefiConfig.apiPathEndpoint,
    fordefiConfig.accessToken,
    response.data.id
  );

  if (signedTx) {
    console.log(`\nFordefi transaction ID: ${signedTx.id}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const finalTx = await get_tx(
      fordefiConfig.apiPathEndpoint,
      fordefiConfig.accessToken,
      signedTx.id
    );
    console.log(`Explorer: ${finalTx.explorer_url}`);
  }

  // ── 7. Verify rotation ────────────────────────────────────────────
  console.log("\nVerifying key rotation...");
  const updatedAccount = await aptos.account.getAccountInfo({
    accountAddress: deployerAddr,
  });
  console.log(`New auth key: ${updatedAccount.authentication_key}`);
  console.log(
    updatedAccount.authentication_key.toLowerCase() ===
      newPublicKeyHex.toLowerCase()
      ? "Key rotation verified successfully!"
      : "WARNING: Auth key does not match expected value"
  );
}

if (require.main === module) {
  main().catch(console.error);
}
