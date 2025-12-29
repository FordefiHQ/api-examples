import dotenv from "dotenv";
import { createHash } from "crypto";
import { NEAR_RPC_URL } from "./near-config";
import { NearStakingConfig } from './interfaces';

dotenv.config();

let nearApi: any;
async function getNearApi() {
    if (!nearApi) {
        nearApi = await import("near-api-js");
    }
    return nearApi;
}

/**
 * Builds a NEAR staking transaction that calls `deposit_and_stake` on a staking pool contract.
 *
 * NEAR staking works by calling a validator's staking pool contract (e.g., "figment.poolv1.near")
 * with the `deposit_and_stake` method, attaching the NEAR tokens to stake.
 */
export async function buildNearStakingPayload(stakingConfig: NearStakingConfig) {
    const near = await getNearApi();

    const sender = stakingConfig.originAddress;
    const stakingPool = stakingConfig.stakingPoolId;

    console.log(`Building NEAR staking transaction from ${sender}`);
    console.log(`Staking pool: ${stakingPool}`);
    console.log(`Amount: ${stakingConfig.amount} yoctoNEAR (${Number(stakingConfig.amount) / 1e24} NEAR)`);

    // Create provider
    const provider = new near.providers.JsonRpcProvider({ url: NEAR_RPC_URL });

    // Get the access keys for the sender's account
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

    // Create function call action for deposit_and_stake
    // The deposit_and_stake method takes no arguments, the stake amount is attached as deposit
    const actions = [
        near.transactions.functionCall(
            "deposit_and_stake",  // Method name
            {},                    // Arguments (empty for deposit_and_stake)
            BigInt(300_000_000_000_000), // Gas (300 TGas)
            stakingConfig.amount   // Deposit amount in yoctoNEAR
        )
    ];

    // Create unsigned transaction
    const transaction = near.transactions.createTransaction(
        sender,
        publicKey,
        stakingPool,  // Receiver is the staking pool contract
        nonce,
        actions,
        recentBlockHash
    );

    console.log("Unsigned staking transaction built successfully");

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
        vault_id: stakingConfig.originVault,
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
