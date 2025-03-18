import { swapAssets } from './operations/create_swap';
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { config } from "./config/bluefin"
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

  // Swap parameters
  const swapParams = {
    poolId: config.Pools[4].id,    // Bluefin Pool ID for SUI/USDC
    amount: 1_000_000,             // Amount to swap (1 SUI = 1_000_000_000 MIST)
    aToB: true,                    // Direction: true = SUI to USDC
    byAmountIn: true,              // byAmountIn: true = amount specified is the input amount
    slippageProtection: 1_000,     // Minimum amount to receive (slippage protection)
    maximumSqrt: "5295032834"      // Maximum allowed sqrt price after the swap (price impact protection) - For aToB swaps, this should be **lower** than current sqrt price
  };

  try {
    console.log("Starting swap operation...");
    console.log(`Pool ID: ${swapParams.poolId}`);
    console.log(`Amount: ${swapParams.amount}`);
    console.log(`Direction: ${swapParams.aToB ? 'SUI to USDC' : 'USDC to SUI'}`);
    console.log(`By amount in: ${swapParams.byAmountIn ? 'Yes' : 'No'}`);
    
    await swapAssets(
      swapParams,
      fordefiConfig.accessToken,
      fordefiConfig.vaultId,
      fordefiConfig.senderAddress,
      client,
      config
    );

    console.log("Swap completed successfully!");
  } catch (error) {
    console.error("Error executing swap:", error);
  }
}

main();