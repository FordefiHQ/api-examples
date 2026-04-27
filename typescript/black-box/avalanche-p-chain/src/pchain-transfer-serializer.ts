import dotenv from "dotenv";
import crypto from "crypto";
import { PCHAIN_RPC_URL } from "./pchain-config";
import { PChainTransferConfig } from './interfaces';

dotenv.config();

let avalanche: any;
async function getAvalanche() {
    if (!avalanche) {
        avalanche = await import("@avalabs/avalanchejs");
    }
    return avalanche;
}

export async function buildPChainTransferPayload(transferConfig: PChainTransferConfig) {
    // Get avalanche module
    const avalanche = await getAvalanche();

    // Initialize PVM API
    const pvmApi = new avalanche.pvm.PVMApi(PCHAIN_RPC_URL);

    const originAddress = transferConfig.originAddress;
    const destinationAddress = transferConfig.destinationAddress;

    console.log(`Building P-Chain transfer from ${originAddress} to ${destinationAddress}`);
    console.log(`Amount: ${transferConfig.amount} nAVAX (${Number(transferConfig.amount) / 1e9} AVAX)`);

    // Get context (network info)
    const context = await avalanche.Context.getContextFromURI(PCHAIN_RPC_URL);
    console.log("Network ID:", context.networkID);
    console.log("P-Chain ID:", context.pBlockchainID);
    console.log("AVAX Asset ID:", context.avaxAssetID);

    // Convert P-Chain addresses to bytes using avalanche utils
    const fromAddressesBytes = [avalanche.utils.bech32ToBytes(originAddress)];
    const toAddressBytes = avalanche.utils.bech32ToBytes(destinationAddress);

    // Fetch UTXOs
    const { utxos } = await pvmApi.getUTXOs({
        addresses: [originAddress],
    });

    console.log(`Found ${utxos.length} UTXOs`);

    if (utxos.length === 0) {
        throw new Error("No UTXOs found for address. Ensure the address has AVAX balance.");
    }

    // Get fee state
    const feeState = await pvmApi.getFeeState();
    console.log("Fee state:", feeState);

    // Create output for the recipient
    const outputs = [
        avalanche.TransferableOutput.fromNative(
            context.avaxAssetID,
            transferConfig.amount,
            [toAddressBytes]
        )
    ];

    console.log("Building base transaction for AVAX transfer...");

    // Build the unsigned base transaction
    const unsignedTx = avalanche.pvm.newBaseTx(
        {
            feeState,
            fromAddressesBytes,
            outputs,
            utxos,
        },
        context
    );

    console.log("Unsigned transaction built successfully");

    // Get transaction bytes for signing
    const txBytes = unsignedTx.toBytes();
    const txHex = Buffer.from(txBytes).toString('hex');

    // For Avalanche P-Chain, we need to get the signing hash
    // This is the hash that each input will sign
    const txHash = crypto.createHash('sha256').update(txBytes).digest();
    const base64Hash = txHash.toString('base64');

    console.log("Transaction hash (hex):", txHash.toString('hex'));
    console.log("Transaction hash (base64):", base64Hash);
    console.log("Transaction size:", txBytes.length, "bytes");

    // Fordefi payload - we're signing the SHA256 hash of the transaction
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
        unsignedTx,
        txHex,
        txBytes
    };
}
