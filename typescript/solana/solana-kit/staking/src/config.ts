import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config()

export type StakeAction = 'stake' | 'unstake' | 'withdraw';

export interface FordefiSolanaConfig {
  accessToken: string;
  originVaultId: string;
  originVaultAddress: string;
  privateKeyPem: string;
  apiPathEndpoint: string;
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
  originVaultId: process.env.ORIGIN_VAULT || "",
  originVaultAddress: process.env.ORIGIN_ADDRESS || "",
  privateKeyPem: fs.readFileSync('./secret/private.pem', 'utf8'),
  apiPathEndpoint: '/api/v1/transactions',
  mainnetRpc: 'https://api.mainnet-beta.solana.com',
  ws: 'wss://api.mainnet-beta.solana.com',
  action: "unstake" as StakeAction,
  amountToStake: "0.001", // does NOT include rent fees
  amountToWithdraw: "0.001",
  validatorAddress: process.env.VALIDATOR_ADDRESS || "", // Validator vote account address, see here: https://staking.kiwi/
  stakeAccountAddress: process.env.STAKE_ACCOUNT_ADDRESS || "", // Required for unstake/withdraw actions, see for example: https://solscan.io/account/CtvSEG7ph7SQumMtbnSKtDTLoUQoy8bxPUcjwvmNgGim#stakeAccounts
};