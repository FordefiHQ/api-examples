import { NEAR_RPC_URL } from "./near-config";
import { FordefiTransactionResponse } from './interfaces';
import { get_tx } from "./process_tx";

let nearApi: any;
async function getNearApi() {
    if (!nearApi) {
        nearApi = await import("near-api-js");
    }
    return nearApi;
}

export async function fetchAndBroadcastNearTransaction(
    transaction: any,
    publicKey: any,
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

    const near = await getNearApi();

    // NEAR ED25519 signatures are 64 bytes
    if (signatureBytes.length !== 64) {
        console.warn(`Warning: Expected 64-byte ED25519 signature, got ${signatureBytes.length} bytes`);
    }

    // Construct signed transaction
    const signedTransaction = new near.transactions.SignedTransaction({
        transaction,
        signature: new near.transactions.Signature({
            keyType: publicKey.keyType,
            data: new Uint8Array(signatureBytes),
        }),
    });

    console.log("Signature added successfully");

    // Broadcast to NEAR
    console.log("Submitting transaction to NEAR network...");

    const provider = new near.providers.JsonRpcProvider({ url: NEAR_RPC_URL });

    // Encode the signed transaction
    const signedSerializedTx = signedTransaction.encode();

    // Broadcast using RPC
    const result = await provider.sendJsonRpc("broadcast_tx_commit", [
        Buffer.from(signedSerializedTx).toString("base64"),
    ]);

    console.log("Transaction submitted successfully!");
    const txHash = result.transaction.hash;
    console.log("Transaction hash:", txHash);

    return {
        txId: txHash,
        status: result.status,
        result,
    };
}
