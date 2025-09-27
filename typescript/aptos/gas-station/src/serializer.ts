import {
    Aptos,
    AptosConfig,
    Deserializer,
    SignedTransaction,
    SimpleTransaction,
    TransactionAuthenticatorMultiAgent,
    AccountAddress,
    Network
} from "@aptos-labs/ts-sdk";
import { FordefiAptosConfig } from "./config";
import { GasStationClient } from "@aptos-labs/gas-station-client";


export async function buildPayload(fordefiConfig: FordefiAptosConfig, APTOS_NETWORK: Network) {
    const config = new AptosConfig({ network: APTOS_NETWORK });
    const aptos = new Aptos(config);

    const originVaultAddress = fordefiConfig.originAddress;
    const destinationAddress = fordefiConfig.destAddress;

    const senderAccount = await aptos.account.getAccountInfo({
        accountAddress: originVaultAddress
    });
    const sequenceNumber = senderAccount.sequence_number;
    console.log(sequenceNumber)

    console.log(`Current sequence number: ${sequenceNumber}`);

    let transaction = await aptos.transaction.build.simple({
        sender: originVaultAddress,
        withFeePayer: true,
        data: {
            function: "0x1::primary_fungible_store::transfer",
            typeArguments: ["0x1::fungible_asset::Metadata"],
            functionArguments: [fordefiConfig.asset, destinationAddress, fordefiConfig.amount],
        },
      });

    const rawTransaction = transaction.rawTransaction

    const [simulatedTransactionResult] = await aptos.transaction.simulate.simple({
        transaction,
    });
    console.debug("Simulation successful: ", simulatedTransactionResult?.success);

    const txPayload = rawTransaction.payload;
    const txBytes = txPayload.bcsToBytes();
    const base64EncodedTransaction = Buffer.from(txBytes).toString('base64');

    const payload = {
        vault_id: fordefiConfig.originVaultId,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: "aptos_transaction",
        details: {
            skip_prediction: false,
            fail_on_prediction_failure: true,
            with_fee_payer: true,
            type: 'aptos_serialized_entry_point_payload',
            chain: 'aptos_mainnet',
            serialized_transaction_payload: base64EncodedTransaction,
            push_mode: 'manual'
        }
    };

    return payload;
}

function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
  
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function sendToGasStation(transaction: any, fordefiConfig: FordefiAptosConfig, APTOS_NETWORK: Network) {
    const sponsor = AccountAddress.from(fordefiConfig.sponsor)
    const gasStationClient = new GasStationClient({
        network: APTOS_NETWORK,
        apiKey: fordefiConfig.sponsor_api_key,
      });

    const { serialized_signed_transaction } = transaction;

    const signedTransactionBytes = base64ToUint8Array(serialized_signed_transaction);
    const deserializer = new Deserializer(signedTransactionBytes);

    const signedTransaction = SignedTransaction.deserialize(deserializer);

    const simpleTransaction = new SimpleTransaction(
        signedTransaction.raw_txn, 
        sponsor
    );
    const multiAuthenticator = signedTransaction.authenticator as TransactionAuthenticatorMultiAgent;

    try {
        const { transactionHash } = await gasStationClient.signAndSubmitTransaction({
            transaction: simpleTransaction,
            senderAuthenticator: multiAuthenticator.sender,
        });

        console.log("Transaction hash: ", transactionHash);
    } catch (error) {
        console.error("Error signing and submitting transaction: ", error);
    }
}

