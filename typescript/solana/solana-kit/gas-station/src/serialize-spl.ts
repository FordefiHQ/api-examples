import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';
import { FordefiSolanaConfig } from './config';
import * as kit from '@solana/kit';

// Transferring without creating the ATA is generally < 10_000 CU, but validating the
// ATA on-chain during an idempotent create adds a ~15_000 CU fluctuation on top.
const COMPUTE_UNIT_LIMIT = 31_000;

// Token-2022. The TransferChecked and idempotent create-ATA instructions are encoded
// identically for both token programs, so the builders imported above work for either
// once the program address is overridden.
const TOKEN_2022_PROGRAM_ADDRESS = kit.address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/**
 * The token program that owns a mint is part of the associated token account's seeds
 * and must be passed to every token instruction, so resolve it from the mint itself
 * rather than assuming the classic SPL Token program.
 */
async function getTokenProgramForMint(
  rpc: ReturnType<typeof kit.createSolanaRpc>,
  mint: kit.Address,
): Promise<kit.Address> {
  const { value } = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
  if (!value) {
    throw new Error(`Mint ${mint} not found - check tokenMint and rpcUrl in config.ts`);
  }
  if (value.owner !== TOKEN_PROGRAM_ADDRESS && value.owner !== TOKEN_2022_PROGRAM_ADDRESS) {
    throw new Error(`Mint ${mint} is not owned by a token program (owner: ${value.owner})`);
  }
  return value.owner;
}

export async function signFeePayerVault(fordefiConfig: FordefiSolanaConfig): Promise<any>{
    const rpc = kit.createSolanaRpc(fordefiConfig.rpcUrl);

    const sourceVault = kit.address(fordefiConfig.originAddress)
    const sourceVaultSigner = kit.createNoopSigner(sourceVault)
    const destVault = kit.address(fordefiConfig.destAddress)
    const feePayer = kit.address(fordefiConfig.feePayer)
    const feePayerSigner =  kit.createNoopSigner(feePayer)
    const mint = kit.address(fordefiConfig.tokenMint)
    console.debug("Source vault: ", sourceVault)
    console.debug("Dest vault: ", destVault)
    console.debug("Fee payer: ", feePayer)

    const tokenProgram = await getTokenProgramForMint(rpc, mint);
    console.debug("Token program: ", tokenProgram)

    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const [sourceAta, destinationAta] = await Promise.all([
      findAssociatedTokenPda({ mint, owner: sourceVault, tokenProgram })
        .then(([ata]) => ata),
      findAssociatedTokenPda({ mint, owner: destVault, tokenProgram })
        .then(([ata]) => ata),
    ]);

    // Annotated so `instructions` stays a plain array; kit would otherwise infer a
    // fixed-length tuple that the role rewrite below can't rebuild.
    let transferTokensTx: kit.TransactionMessage
      & kit.TransactionMessageWithFeePayer
      & kit.TransactionMessageWithLifetime = kit.pipe(
      kit.createTransactionMessage({ version: "legacy" }),
      message => kit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message),
      message => kit.setTransactionMessageFeePayerSigner(feePayerSigner, message),
      message => kit.appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction({ units: COMPUTE_UNIT_LIMIT }),
          // Create idempotent will gracefully fail if the ata already exists. this is the gold standard!
          getCreateAssociatedTokenIdempotentInstruction({
            owner: destVault,
            mint,
            ata: destinationAta,
            payer: feePayerSigner,
            tokenProgram,
          }),
          // TransferChecked rather than the plain Transfer: Token-2022 rejects the
          // unchecked variant on mints carrying the transfer-fee extension.
          getTransferCheckedInstruction(
            {
              authority: sourceVaultSigner,
              source: sourceAta,
              mint,
              destination: destinationAta,
              amount: fordefiConfig.amount,
              decimals: Number(fordefiConfig.decimals),
            },
            { programAddress: tokenProgram },
          ),
        ],
        message,
      ),
    );

    const ix = transferTokensTx.instructions
    const tokenTransferIxIndex = ix.findIndex(instruction => instruction.programAddress === tokenProgram);
    if (tokenTransferIxIndex !== -1) {
      const tokenTransferIx = ix[tokenTransferIxIndex];
      if (tokenTransferIx && tokenTransferIx.accounts) {
        // Upgrade ALL readonly signers to writable signers
        const updatedAccounts = tokenTransferIx.accounts.map((account) => {
          if (account.role === kit.AccountRole.READONLY_SIGNER) {
            return {
              ...account,
              role: kit.AccountRole.WRITABLE_SIGNER
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

    const compiledTx = kit.compileTransaction(transferTokensTx);
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
            "chain": fordefiConfig.chain,
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
          "chain": fordefiConfig.chain,
          "data": serializedMessage,
          "signatures": signatures
      }
  };

  return jsonBody;
}
