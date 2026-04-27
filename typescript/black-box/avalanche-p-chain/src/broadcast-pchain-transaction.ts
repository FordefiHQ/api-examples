import { PCHAIN_RPC_URL } from "./pchain-config";
import { FordefiTransactionResponse } from './interfaces';
import { get_tx } from "./process_tx";

let avalanche: any;
async function getAvalanche() {
    if (!avalanche) {
        avalanche = await import("@avalabs/avalanchejs");
    }
    return avalanche;
}

export async function fetchAndBroadcastPChainTransaction(
  unsignedTx: any, // UnsignedTx type
  fordefiTxId: string,
  accessToken: string,
  apiPath: string = '/api/v1/transactions'
) {
  // Poll for transaction completion with retries
  const maxRetries = 10;
  const retryDelayMs = 2000;
  let fordefiResponse: FordefiTransactionResponse | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Fetching transaction ${fordefiTxId} from Fordefi (attempt ${attempt}/${maxRetries})...`);
    fordefiResponse = await get_tx(
      apiPath,
      accessToken,
      fordefiTxId
    );

    console.log("Fordefi transaction state:", fordefiResponse!.state);

    if (fordefiResponse!.state === "completed") {
      break;
    }

    if (attempt < maxRetries) {
      console.log(`Transaction not yet completed. Waiting ${retryDelayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  if (!fordefiResponse || fordefiResponse.state !== "completed") {
    throw new Error(`Transaction not completed after ${maxRetries} attempts. Current state: ${fordefiResponse?.state || 'unknown'}`);
  }

  // Pull signature from Fordefi response
  if (!fordefiResponse.signatures || fordefiResponse.signatures.length === 0) {
    throw new Error("No signatures found in completed transaction");
  }

  const signatureBase64 = fordefiResponse.signatures[0]!.data;
  const signatureBytes = Buffer.from(signatureBase64, 'base64');

  console.log("Signature received from Fordefi (length):", signatureBytes.length, "bytes");
  console.log("Signature hex:", signatureBytes.toString('hex'));
  console.log("Recovery ID (v):", signatureBytes[64]);

  const avalanche = await getAvalanche();

  // Create a Signature object from the signature bytes
  const signature = new avalanche.Signature(new Uint8Array(signatureBytes));

  // Create credentials with the signature in the constructor
  const credential = new avalanche.Credential([signature]);

  // Get the signed transaction and set credentials
  const signedTx = unsignedTx.getSignedTx();
  signedTx.credentials = [credential];

  console.log("Signature added successfully");

  // Broadcast to P-Chain
  console.log("Submitting transaction to P-Chain node...");

  const pvmApi = new avalanche.pvm.PVMApi(PCHAIN_RPC_URL);

  const txId = await pvmApi.issueSignedTx(signedTx);

  console.log("Transaction submitted successfully!");
  console.log("Transaction ID:", txId);

  console.log("Checking transaction status...");
  // The txId returned is an object with txID property, extract the string
  const txIdString = typeof txId === 'string' ? txId : txId.txID;
  const status = await pvmApi.getTxStatus({ txID: txIdString });
  console.log("Transaction status:", status);

  // Get the signed transaction hex for return
  const signedTxBytes = signedTx.toBytes();
  const signedTxHex = Buffer.from(signedTxBytes).toString('hex');

  return {
    txId: txIdString,
    status,
    signedTxHex,
  };
}
