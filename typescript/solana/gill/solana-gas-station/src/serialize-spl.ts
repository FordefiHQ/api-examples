import { buildTransferTokensTransaction } from "gill/programs/token";
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { FordefiSolanaConfig } from './config';
import * as gill from 'gill';

global.__GILL_DEBUG__ = true

const { rpc } = gill.createSolanaClient({
  urlOrMoniker: "mainnet",
});

export async function signFeePayerVault(fordefiConfig: FordefiSolanaConfig): Promise<any>{
    const sourceVault = gill.address(fordefiConfig.originAddress)
    const sourceVaultSigner = gill.createNoopSigner(sourceVault)
    const destVault = gill.address(fordefiConfig.destAddress)
    const feePayer = gill.address(fordefiConfig.feePayer)
    const feePayerSigner =  gill.createNoopSigner(feePayer)
    const mint = gill.address(fordefiConfig.tokenMint)
    console.debug("Source vault: ", sourceVault)
    console.debug("Dest vault: ", destVault)
    console.debug("Fee payer: ", feePayer)

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    
    let transferTokensTx = await buildTransferTokensTransaction({
      feePayer: feePayerSigner,
      latestBlockhash,
      mint,
      authority: sourceVaultSigner,
      amount: fordefiConfig.amount,
      destination: destVault,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      version: "legacy"
    });

    const ix = transferTokensTx.instructions
    const tokenTransferIxIndex = ix.findIndex(instruction => instruction.programAddress === TOKEN_PROGRAM_ADDRESS);
    if (tokenTransferIxIndex !== -1) {
      const tokenTransferIx = ix[tokenTransferIxIndex];
      if (tokenTransferIx && tokenTransferIx.accounts) {
        // Upgrade ALL readonly signers to writable signers
        const updatedAccounts = tokenTransferIx.accounts.map((account) => {
          if (account.role === 2) { // AccountRole.READONLY_SIGNER
            return {
              ...account,
              role: 3 // AccountRole.WRITABLE_SIGNER
            };
          }
          return account;
        });
        
        // Create new transaction with updated roles
        transferTokensTx = {
          ...transferTokensTx,
          instructions: transferTokensTx.instructions.map((instr, i) => 
            i === tokenTransferIxIndex ? { ...tokenTransferIx, accounts: updatedAccounts } : instr
          )
        };
      }
    }
    
    const compiledTx = await gill.compileTransaction(transferTokensTx);
    const serializedMessage = Buffer.from(compiledTx.messageBytes).toString('base64');
    
    const jsonBody = {
        "vault_id": fordefiConfig.feePayerVault,
        "signer_type": "api_signer",
        "sign_mode": "auto",
        "type": "solana_transaction",
        "details": {
            "skip_prediction": false,
            "type": "solana_serialized_transaction_message",
            "push_mode": "manual",
            "chain": "solana_mainnet",
            "data": serializedMessage,
            "signatures": [{ data: null }, { data: null }]
        }
    };

    return jsonBody;
}

export async function signWithSourceVault(fordefiConfig: FordefiSolanaConfig, signatures: any, serializedMessage: any): Promise<any> {  
  const jsonBody = {
      "vault_id": fordefiConfig.originVault, 
      "signer_type": "api_signer",
      "sign_mode": "auto",
      "type": "solana_transaction",
      "details": {
          "skip_prediction": false,
          "type": "solana_serialized_transaction_message",
          "push_mode": "auto",
          "chain": "solana_mainnet",
          "data": serializedMessage,
          "signatures": signatures
      }
  };

  return jsonBody;
}