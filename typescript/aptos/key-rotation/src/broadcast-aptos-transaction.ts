import {
  Aptos,
  AptosConfig,
  Ed25519Signature,
  Ed25519PublicKey,
  SimpleTransaction,
  AccountAuthenticatorEd25519,
} from "@aptos-labs/ts-sdk";
import { APTOS_NETWORK } from "./config";
import { get_tx } from "./process_tx";

const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);

interface FordefiTransactionResponse {
  id: string;
  state: string;
  details: {
    type: string;
    signature: string;
    hash_binary: string;
  };
}

export async function fetchAndBroadcastTransaction(
  originalTransaction: SimpleTransaction,
  senderPublicKey: Ed25519PublicKey,
  fordefiTxId: string,
  accessToken: string,
  apiPath: string = '/api/v1/transactions'
) {
  console.log(`Fetching transaction ${fordefiTxId} from Fordefi...`);
  const fordefiResponse: FordefiTransactionResponse = await get_tx(
    apiPath,
    accessToken,
    fordefiTxId
  );

  console.log("Fordefi transaction state:", fordefiResponse.state);

  if (fordefiResponse.state !== "completed") {
    throw new Error(`Transaction not completed. Current state: ${fordefiResponse.state}`);
  }

  const signatureBase64 = fordefiResponse.details.signature;
  const signatureBytes = Buffer.from(signatureBase64, 'base64');
  console.log("Signature extracted:", signatureBase64);

  const signature = new Ed25519Signature(signatureBytes);

  const authenticator = new AccountAuthenticatorEd25519(
    senderPublicKey,
    signature
  );

  console.log("Submitting transaction to Aptos node...");
  const response = await aptos.transaction.submit.simple({
    transaction: originalTransaction,
    senderAuthenticator: authenticator,
  });

  console.log("Transaction submitted:", response.hash);

  const executedTransaction = await aptos.waitForTransaction({
    transactionHash: response.hash,
  });

  console.log("Transaction executed successfully!");

  return {
    hash: response.hash,
    executedTransaction,
  };
}
