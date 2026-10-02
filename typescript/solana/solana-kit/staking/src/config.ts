import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// All solana-kit examples share one .env and one API User key at the solana-kit root.
// A .env in this project, if present, takes precedence over the shared one.
const SOLANA_KIT_ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: ['.env', path.join(SOLANA_KIT_ROOT, '.env')] });
const PRIVATE_KEY_PATH = process.env.FORDEFI_PRIVATE_KEY_PATH || path.join(SOLANA_KIT_ROOT, 'secret', 'private.pem');

export type StakeAction = 'stake' | 'unstake' | 'withdraw';

export interface FordefiSolanaConfig {
  accessToken: string;
  originVaultId: string;
  originVaultAddress: string;
  privateKeyPem: string;
  chain: 'solana_mainnet' | 'solana_devnet';
  mainnetRpc: string;
  ws: string;
  action: StakeAction;
  amountToStake: string;
  amountToWithdraw: string;
  validatorAddress: string;
  stakeAccountAddress: string;
}

export const fordefiConfig: FordefiSolanaConfig = {
  accessToken: process.env.FORDEFI_API_TOKEN || "",
  originVaultId: process.env.FORDEFI_VAULT_ID || "",
  originVaultAddress: process.env.FORDEFI_VAULT_ADDRESS || "",
  privateKeyPem: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
  chain: 'solana_mainnet',
  mainnetRpc: 'https://api.mainnet-beta.solana.com',
  ws: 'wss://api.mainnet-beta.solana.com',
  action: process.env.ACTION as StakeAction,
  amountToStake: "1", // does NOT include rent fees; must be at least the minimum delegation (1 SOL on mainnet)
  amountToWithdraw: "0.001",
  validatorAddress: process.env.VALIDATOR_ADDRESS || "", // Validator vote account address, see here: https://staking.kiwi/
  stakeAccountAddress: process.env.STAKE_ACCOUNT_ADDRESS || "", // Required for unstake/withdraw actions, see for example: https://solscan.io/account/CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim#stakeAccounts
};