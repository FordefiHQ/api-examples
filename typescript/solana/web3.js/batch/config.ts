import { FordefiSolanaConfig, BatchConfig } from './interfaces'
import { PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

export const TOKEN_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  // USDC mint

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  vaultId: process.env.VAULT_ID || "",
  fordefiSolanaVaultAddress: process.env.VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions/create-and-wait'
};

export const batchConfig: BatchConfig = {
  fordefiVault: new PublicKey(fordefiConfig.fordefiSolanaVaultAddress),
  recipientsList: [
    new PublicKey("9BgxwZMyNzGUgp6hYXMyRKv3kSkyYZAMPGisqJgnXCFS"),
    new PublicKey("FEwZdEBick94iFJcuVQS2gZyqhSDunSs82FTZgk26RpD"),
    new PublicKey("GAPpdNzX3BnsHYJvRH2MiaTqKhDd7QFnwWskxtTLJsbf")
  ],
  amountPerRecipient: 100n, // in smallest unit of SOL or SPL token
  tableAddress: new PublicKey('Aa42pWo31dHzgeh7WsfkSz14tgYqqfLVw9cGHCTwibBe'), // update with your ALT
  action: "create", // create, extend or batch
  isSplBatch: false // set to true for SPL token transfers, set to false for SOL transfers
};