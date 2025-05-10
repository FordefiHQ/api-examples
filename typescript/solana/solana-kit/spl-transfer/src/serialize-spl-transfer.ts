import * as kit from '@solana/kit';
import { FordefiSolanaConfig } from './tx-spl'
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getTransferCheckedInstruction,
} from '@solana-program/token';

const mainnetRpc = kit.createSolanaRpc('https://api.mainnet-beta.solana.com');
const USDC_MINT        = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DECIMALS         = 6n;                                            
const AMOUNT           = 1n * 10n ** DECIMALS;  

export async function createTx(fordefiConfig: FordefiSolanaConfig){
    const sourceVault = kit.address(fordefiConfig.originAddress)
    const destVault = kit.address(fordefiConfig.destAddress)
    const feePayer = kit.address(fordefiConfig.feePayer)
    const usdcMint = kit.address(USDC_MINT)

    const [sourceAta] = await findAssociatedTokenPda({
      owner:      sourceVault,
      mint:       usdcMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.debug("Source ATA", sourceAta)
    
    const [destAta] = await findAssociatedTokenPda({
      owner:        destVault,
      mint:         usdcMint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    console.debug("Destination ATA", destAta)

    // Token transfer ixs
    const ixes: any = [];
    ixes.push(
      getTransferCheckedInstruction({
        source:      sourceAta,
        destination: destAta,
        mint:        usdcMint,
        authority:   sourceVault,       
        amount:      AMOUNT,
        decimals:    Number(DECIMALS)
      })
    );

    const { value: latestBlockhash } = await mainnetRpc.getLatestBlockhash().send();

    const txMessage = kit.pipe(
      kit.createTransactionMessage({ version: 0 }),
      message => kit.setTransactionMessageFeePayer(sourceVault, message),
      message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      message => {
        return kit.appendTransactionMessageInstruction(ixes[0], message);
      }
    );
    console.log("Tx message: ", txMessage)
    console.log("Tx instructions detailed:", JSON.stringify(txMessage.instructions, null, 2));

    const signedTx = await kit.partiallySignTransactionMessageWithSigners(txMessage)
    console.log("Signed transaction: ", signedTx)

    const signatures = Object.values(signedTx.signatures);
    const firstSignature = signatures[0] ? Buffer.from(signatures[0]).toString('base64') : null;
    console.log("First signature", firstSignature)
    const secondSignature = signatures[1] ? Buffer.from(signatures[1]).toString('base64') : null;
    console.log("Second signature", secondSignature)

    const base64EncodedData = Buffer.from(signedTx.messageBytes).toString('base64');
    console.debug("Raw data ->", base64EncodedData)

    const jsonBody = {
        "vault_id": fordefiConfig.originVault,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "type": "solana_serialized_transaction_message",
            "push_mode": "auto",
            "chain": "solana_mainnet",
            "data": base64EncodedData,
            "signatures":[
              {data: firstSignature}
            ]
        },
        "wait_for_state": "signed" // only for create-and-wait
    };

    return jsonBody;
}