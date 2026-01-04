import * as kit from '@solana/kit';
import { postTx, pollForSignedTransaction, getTx } from '../src/process-tx';
import { signPayloadWithApiUserPrivateKey } from "../src/signers";
import { fordefiConfig, FordefiSolanaConfig } from '../src/config';
import { getInitializeInstruction } from '../clients/js/src/generated/instructions/initialize';

describe('it creates a new counter account', () => {
    let txPayload;
    before(async () => {
        txPayload = await generatePayload(fordefiConfig);
    })

    it("Is initialized!", async () => {
        console.log("JSON request: ", txPayload)
        const requestBody = JSON.stringify(txPayload);
        const timestamp = new Date().getTime();
        const payload = `${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`;
        try {
            const signature = await signPayloadWithApiUserPrivateKey(payload, fordefiConfig.privateKeyPem);
            const response = await postTx(fordefiConfig, signature, timestamp, requestBody);
            const data = response.data;
            console.log("Transaction submitted to Fordefi for broadcast ✅");
            console.log(`Transaction ID: ${data.id}`);
            const result = await pollForSignedTransaction(data.id, fordefiConfig.accessToken);
            console.log(result);
            const broadcastTx = await getTx(data.id, fordefiConfig.accessToken)
            console.log(`Link to explorer:\n${broadcastTx.explorer_url}`);

        } catch (error: any) {
            console.error(`Failed to sign the transaction: ${error.message}`);
        }


    });


})

async function generatePayload(fordefiConfig: FordefiSolanaConfig){
    const fordefiSolanaVaultId = fordefiConfig.deployerVaultId;
    const fordefiSolanaVaultAddress =  fordefiConfig.deployerVaultAddress;
    const deployerVaultSigner = await kit.createNoopSigner(kit.address(fordefiSolanaVaultAddress));
        
    let ix = await getInitializeInstruction()

    const message = kit.pipe(
        kit.createTransactionMessage({ version: 0 }),
        msg => kit.setTransactionMessageFeePayerSigner(deployerVaultSigner, msg),
        msg => kit.appendTransactionMessageInstructions([ix], msg),
    );

    const partiallySignedTx = await kit.partiallySignTransactionMessageWithSigners(message);
    console.log("Signed transaction: ", partiallySignedTx)
    const base64EncodedData = Buffer.from(partiallySignedTx.messageBytes).toString('base64');
    
    const jsonBody = {
        "vault_id": fordefiSolanaVaultId,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "skip_prediction": false,
            "type": "solana_serialized_transaction_message",
            "push_mode": "auto",
            "chain": "solana_devnet",
            "data": base64EncodedData,
        },
        "wait_for_state": "signed"
    };

    return jsonBody;

}