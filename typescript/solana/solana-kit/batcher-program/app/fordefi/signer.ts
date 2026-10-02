import {
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionMessageWithSigners,
} from "@solana/kit";
import { fordefiConfig } from "../config";

// Kit signer for the Fordefi vault. Use it everywhere the vault appears as a signer:
// Kit asks it to sign when the transaction message is signed.
export async function createVaultSigner() {
  // @solana/keychain-fordefi is ESM-only, so this CommonJS project loads it with a dynamic import
  const { createFordefiSigner } = await import("@solana/keychain-fordefi");
  const signerConfig = {
    accessToken: fordefiConfig.accessToken,
    vaultId: fordefiConfig.originVault,
    publicKey: fordefiConfig.originAddress,
    privateKeyPem: fordefiConfig.privateKeyPem,
    chain: fordefiConfig.chain,
  };
  // manual: Fordefi signs and we broadcast to our own RPC; auto: Fordefi signs and broadcasts
  return fordefiConfig.push_to_custom_url
    ? await createFordefiSigner({ ...signerConfig, pushMode: "manual" })
    : await createFordefiSigner({ ...signerConfig, pushMode: "auto" });
}

export async function signAndSendWithFordefi(
  message: TransactionMessage & TransactionMessageWithFeePayer & TransactionMessageWithSigners,
  rpc: Rpc<SolanaRpcApi>,
): Promise<Signature> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const messageWithBlockhash = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

  if (!fordefiConfig.push_to_custom_url) {
    const signature = await signAndSendTransactionMessageWithSigners(messageWithBlockhash);
    console.log("Transaction pushed by Fordefi (push_mode: auto).");
    return getBase58Decoder().decode(signature) as Signature;
  }

  // Fordefi may refresh the blockhash and fees before signing, so we broadcast the transaction it returns
  const transaction = await signTransactionMessageWithSigners(messageWithBlockhash);
  console.log("Signed by Fordefi MPC, sending transaction to network...");
  const signature = await rpc
    .sendTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      skipPreflight: false,
      preflightCommitment: "confirmed",
    })
    .send();
  console.log("Transaction signature:", signature);

  console.log("Waiting for confirmation...");
  const { value: statuses } = await rpc.getSignatureStatuses([signature]).send();
  const status = statuses[0];
  if (status?.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
  }
  console.log("Transaction sent successfully.");
  return signature;
}
