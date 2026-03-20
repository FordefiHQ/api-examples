import { createHash } from "crypto";
import { NEAR_RPC_URL } from "../near-config";

let nearApi: any;
async function getNearApi() {
    if (!nearApi) {
        nearApi = await import("near-api-js");
    }
    return nearApi;
}

export interface DepositConfig {
    originVault: string;
    originAddress: string;
    tokenContract: string;   // NEP-141 token contract (e.g. "wrap.near")
    depositAddress: string;  // 1Click deposit address
    amount: string;          // Amount in smallest unit as string
    nonceOverride?: number;  // If set, use this nonce instead of querying RPC
}

/**
 * Builds an ft_transfer transaction to deposit tokens to a 1Click deposit address.
 * Follows the same serializer pattern as the other modules.
 */
export async function buildDepositPayload(config: DepositConfig) {
    const near = await getNearApi();

    const sender = config.originAddress;

    console.log(`Building ft_transfer to deposit address`);
    console.log(`Token contract: ${config.tokenContract}`);
    console.log(`Deposit address: ${config.depositAddress}`);
    console.log(`Amount: ${config.amount}`);

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

    const nonce = config.nonceOverride ?? accessKey.nonce + 1;
    console.log("Nonce:", nonce);

    const recentBlockHash = near.utils.serialize.base_decode(accessKey.block_hash);
    const publicKey = near.utils.PublicKey.fromString(publicKeyStr);

    // Check if the deposit address is registered on the token contract
    let needsStorageDeposit = false;
    try {
        const storageBalance = await provider.query({
            request_type: "call_function",
            finality: "final",
            account_id: config.tokenContract,
            method_name: "storage_balance_of",
            args_base64: Buffer.from(JSON.stringify({ account_id: config.depositAddress })).toString("base64"),
        });
        const result = JSON.parse(Buffer.from(storageBalance.result).toString());
        needsStorageDeposit = result === null;
    } catch {
        needsStorageDeposit = true;
    }

    const actions = [];

    if (needsStorageDeposit) {
        console.log(`Deposit address not registered on ${config.tokenContract}, adding storage_deposit`);
        actions.push(
            near.transactions.functionCall(
                "storage_deposit",
                { account_id: config.depositAddress },
                BigInt(30_000_000_000_000),          // 30 TGas
                BigInt("12500000000000000000000")     // 0.0125 NEAR (standard NEP-141 storage)
            )
        );
    }

    actions.push(
        near.transactions.functionCall(
            "ft_transfer",
            {
                receiver_id: config.depositAddress,
                amount: config.amount,
                memo: "1click-intent",
            },
            BigInt(100_000_000_000_000), // 100 TGas
            BigInt(1)                     // 1 yoctoNEAR (NEP-141 requirement)
        )
    );

    const transaction = near.transactions.createTransaction(
        sender,
        publicKey,
        config.tokenContract,
        nonce,
        actions,
        recentBlockHash
    );

    console.log("Unsigned ft_transfer transaction built successfully");

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
        serializedTx
    };
}
