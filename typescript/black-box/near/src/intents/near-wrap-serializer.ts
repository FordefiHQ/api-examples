import { createHash } from "crypto";
import { NEAR_RPC_URL, WNEAR_CONTRACT } from "../near-config";

let nearApi: any;
async function getNearApi() {
    if (!nearApi) {
        nearApi = await import("near-api-js");
    }
    return nearApi;
}

export interface WrapConfig {
    originVault: string;
    originAddress: string;
    amount: bigint; // Amount in yoctoNEAR to wrap
}

/**
 * Builds a transaction to wrap NEAR → wNEAR by calling `near_deposit` on wrap.near/wrap.testnet.
 * Follows the same pattern as near-staking-serializer.ts.
 */
export async function buildWrapNearPayload(config: WrapConfig) {
    const near = await getNearApi();

    const sender = config.originAddress;
    const wrapContract = WNEAR_CONTRACT;

    console.log(`Building wrap NEAR transaction from ${sender}`);
    console.log(`Wrap contract: ${wrapContract}`);
    console.log(`Amount: ${config.amount} yoctoNEAR (${Number(config.amount) / 1e24} NEAR)`);

    const provider = new near.providers.JsonRpcProvider({ url: NEAR_RPC_URL });

    const accessKeys = await provider.query({
        request_type: "view_access_key_list",
        finality: "final",
        account_id: sender,
    });

    if (accessKeys.keys.length === 0) {
        throw new Error("No access keys found for account.");
    }

    const fullAccessKey = accessKeys.keys.find((k: any) => k.access_key.permission === "FullAccess");
    if (!fullAccessKey) {
        throw new Error("No full access key found for account.");
    }

    const publicKeyStr = fullAccessKey.public_key;
    console.log("Using public key:", publicKeyStr);

    const accessKey = await provider.query({
        request_type: "view_access_key",
        finality: "final",
        account_id: sender,
        public_key: publicKeyStr,
    });

    const nonce = accessKey.nonce + 1;
    console.log("Nonce:", nonce);

    const recentBlockHash = near.utils.serialize.base_decode(accessKey.block_hash);
    const publicKey = near.utils.PublicKey.fromString(publicKeyStr);

    const actions = [
        near.transactions.functionCall(
            "near_deposit",     // Method name
            {},                  // No arguments
            BigInt(30_000_000_000_000), // 30 TGas
            config.amount        // Deposit: NEAR to wrap
        )
    ];

    const transaction = near.transactions.createTransaction(
        sender,
        publicKey,
        wrapContract,
        nonce,
        actions,
        recentBlockHash
    );

    console.log("Unsigned wrap transaction built successfully");

    const serializedTx = near.utils.serialize.serialize(
        near.transactions.SCHEMA.Transaction,
        transaction
    );

    const txBytes = new Uint8Array(serializedTx);
    const txHash = createHash('sha256').update(txBytes).digest();
    const base64Hash = txHash.toString('base64');

    console.log("Transaction hash (base64):", base64Hash);

    const payload = {
        vault_id: config.originVault,
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
        serializedTx,
        nonce,
    };
}
