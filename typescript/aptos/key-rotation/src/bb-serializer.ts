import dotenv from "dotenv";
import crypto from "crypto";
import {
  Aptos,
  AptosConfig,
  generateSigningMessageForTransaction } from "@aptos-labs/ts-sdk";
import { FordefiAptosConfig, APTOS_NETWORK } from "./config";

dotenv.config();

const config = new AptosConfig({ network: APTOS_NETWORK });
const aptos = new Aptos(config);

export async function buildAptTransferPayload(fordefiConfig: FordefiAptosConfig){
    const originVaultAddress = fordefiConfig.fordefiVaultAddress
    const destinationAddress = fordefiConfig.externalWalletAddress

    const senderAccount = await aptos.account.getAccountInfo({
        accountAddress: originVaultAddress
    });
    const sequenceNumber = senderAccount.sequence_number;
    console.log(sequenceNumber)

    console.log(`Current sequence number for ${originVaultAddress}: ${sequenceNumber}`);

    const txCount = await aptos.getAccountTransactionsCount({
        accountAddress: originVaultAddress,
    });
    console.log("Account transaction count: ", txCount)

    let transaction = await aptos.transaction.build.simple({
        sender: originVaultAddress,
        withFeePayer: false,
        data: {
            function: "0x1::aptos_account::transfer",
            typeArguments: [],
            functionArguments: [destinationAddress, fordefiConfig.amount],
          }
      });

    console.debug("Transaction", transaction)

    const [simulatedTransactionResult] = await aptos.transaction.simulate.simple({
        transaction,
    });
    console.debug("Simulation successful: ", simulatedTransactionResult?.success)

    const signingMessage = generateSigningMessageForTransaction(transaction);
    const txHash = crypto.createHash('sha256').update(signingMessage).digest('hex');
    const base64Hash = Buffer.from(signingMessage).toString('base64');

    console.log("Signing message hash:", txHash);
    console.log("Base64 signing message:", base64Hash);

    const payload = {
        vault_id: fordefiConfig.fordefiVaultID,
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
        rawTransactionHash: txHash,
        transaction
    };
}

