import dotenv from 'dotenv';
import { FordefiConfig, ContractCallParams }  from './interfaces/inferfaces'

dotenv.config();

export const fordefiConfig: FordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.STACKS_VAULT_ID ?? "",
  vaultAddress: process.env.STACKS_VAULT_ADDRESS ?? "",
  privateKeyPath: "./secret/private.pem",
  pathEndpoint: "/api/v1/transactions",
  baseApiUrl: 'https://api.fordefi.com' 
};

export const contractCallParams: ContractCallParams = {
  // Bitflow DLMM liquidity router
  contractAddress: "SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD",
  contractName: "dlmm-liquidity-router-v-1-2",
  functionName: "withdraw-liquidity-multi",

  // Pool & token traits (STX-USDCx pool)
  poolTraitAddress: "SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD",
  poolTraitName: "dlmm-pool-stx-usdcx-v-1-bps-10",
  xTokenAddress: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  xTokenName: "token-stx-v-1-2",
  yTokenAddress: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE",
  yTokenName: "usdcx",

  // 2 bins for a minimal example
  bins: [
    { amount: 170_000_630, binId: -132, minXAmount: 0, minYAmount: 164_997_871 },
    { amount: 148_444_501, binId: -131, minXAmount: 0, minYAmount: 143_874_194 },
  ],

  fee: "2000000", // 2 STX in microSTX
  note: "My Test Stack Contract Call",
};
