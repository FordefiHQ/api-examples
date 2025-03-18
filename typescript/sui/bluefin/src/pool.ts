import { openPositionWithFixedAmount } from './operations/create_pool';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { config } from './config/bluefin'
import dotenv from 'dotenv';

dotenv.config();

// Initialize SUI client
const client = new SuiClient({
  url: getFullnodeUrl("mainnet"),
});

const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  privateKeyPath: "./fordefi_secret/private.pem",
  vaultId: process.env.VAULT_ID || "",
  network: "mainnet" as const,
  senderAddress:process.env.VAULT_ADDRESS || ""
};

async function main() {

  // Liquidity params
  const liquidityParams = {
    fix_amount_a: true, 
    coinAmount: "1000", // Amount of the fixed token
    tokenMaxA: "1000", // Max amount of token A to use (if fix_amount_a is false)
    tokenMaxB: "1000",  // Max amount of token B to use (if fix_amount_a is true)
    lowerTick: -100000,
    upperTick: 100000
  };

  try {

    const result = await openPositionWithFixedAmount(
      config,
      liquidityParams,
      fordefiConfig,
      client
    );

    console.log("Transaction result:", result);
  } catch (error) {
    console.error("Error opening position:", error);
  }
}

main();