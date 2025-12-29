import dotenv from "dotenv";
import { createHash } from "crypto";
import { NEAR_RPC_URL } from "./near-config";
import { NearTransferConfig } from './interfaces';

dotenv.config();

let nearApi: any;
async function getNearApi() {
    if (!nearApi) {
        nearApi = await import("near-api-js");
    }
    return nearApi;
}

export async function buildNearTransferPayload(transferConfig: NearTransferConfig) {
    const near = await getNearApi();

    const sender = transferConfig.originAddress;
    const receiver = transferConfig.destinationAddress;

    console.log(`Building NEAR transfer from ${sender} to ${receiver}`);
    console.log(`Amount: ${transferConfig.amount} yoctoNEAR (${Number(transferConfig.amount) / 1e24} NEAR)`);

    // Create provider
    const provider = new near.providers.JsonRpcProvider({ url: NEAR_RPC_URL });

    // Get the public key in NEAR format from the sender's account
    // For implicit accounts, we need to query the access keys
    const accessKeys = await provider.query({
        request_type: "view_access_key_list",
        finality: "final",
        account_id: sender,
    });

    console.log("Access keys found:", accessKeys.keys.length);

    if (accessKeys.keys.length === 0) {
        throw new Error("No access keys found for account. Ensure the account exists and has keys.");
    }

    // Use the first full access key
    const fullAccessKey = accessKeys.keys.find((k: any) => k.access_key.permission === "FullAccess");
    if (!fullAccessKey) {
        throw new Error("No full access key found for account.");
    }

    const publicKeyStr = fullAccessKey.public_key;
    console.log("Using public key:", publicKeyStr);

    // Get nonce for the key
    const accessKey = await provider.query({
        request_type: "view_access_key",
        finality: "final",
        account_id: sender,
        public_key: publicKeyStr,
    });

    const nonce = accessKey.nonce + 1;
    console.log("Nonce:", nonce);

    // Get recent block hash
    const recentBlockHash = near.utils.serialize.base_decode(accessKey.block_hash);
    console.log("Block hash:", accessKey.block_hash);

    // Parse the public key
    const publicKey = near.utils.PublicKey.fromString(publicKeyStr);

    // Create transfer action
    const actions = [near.transactions.transfer(transferConfig.amount)];

    // Create unsigned transaction
    const transaction = near.transactions.createTransaction(
        sender,
        publicKey,
        receiver,
        nonce,
        actions,
        recentBlockHash
    );

    console.log("Unsigned transaction built successfully");

    // Serialize the transaction
    const serializedTx = near.utils.serialize.serialize(
        near.transactions.SCHEMA.Transaction,
        transaction
    );

    const txBytes = new Uint8Array(serializedTx);

    // NEAR uses SHA256 hash of the serialized transaction for signing
    const txHash = createHash('sha256').update(txBytes).digest();
    const base64Hash = txHash.toString('base64');

    console.log("Transaction hash (hex):", txHash.toString('hex'));
    console.log("Transaction hash (base64):", base64Hash);
    console.log("Transaction size:", txBytes.length, "bytes");

    // Fordefi payload - signing the SHA256 hash of the transaction
    const payload = {
        vault_id: transferConfig.originVault,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: "black_box_signature",
        details: {
            format: 'hash_binary',
            hash_binary: base64Hash
        }
    };

    return {
        payload,
        rawTransactionHash: txHash.toString('hex'),
        transaction,
        txBytes: Buffer.from(txBytes),
        publicKey,
        serializedTx
    };
}
