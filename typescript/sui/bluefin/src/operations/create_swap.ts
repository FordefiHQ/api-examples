import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot";
import { Transaction } from "@mysten/sui/transactions";
import { signWithApiSigner } from "../api_request/signer";
import { SuiClient } from "@firefly-exchange/library-sui";
import { formRequest } from "../api_request/form_request";
import { createAndSignTx } from "../api_request/pushToApi";

// Selects coins for gas and swap operation
async function selectCoins(client: SuiClient, senderAddress: string, amount: string, tx: Transaction) {
  let allCoins = (await client.getCoins({
    owner: senderAddress,
    coinType: "0x2::sui::SUI",
  })).data;
  allCoins.sort((a, b) => Number(b.balance) - Number(a.balance));
  console.log("My coins 🪙🪙 -> ", allCoins);

  let coinForGas: any;
  let coinForSwap: any;
  
  if (allCoins.length >= 2) {
    // Use largest for gas, the second largest for swap
    coinForGas = allCoins[0];
    coinForSwap = allCoins[1];
  } else {
    // Only 1 coin let's split it!
    console.log("Only one coin in wallet, let's split it! 🪓🪓");
    coinForGas = allCoins[0];
    if (!coinForGas) {
      throw new Error("No SUI coins found to pay for gas.");
    }
  }
  
  if (!coinForSwap) {
    [coinForSwap] = tx.splitCoins(tx.gas, [amount]);
  }
  
  console.log("Coin for swap 🤝 -> ", coinForSwap);
  console.log("Coin for gas ⛽ -> ", coinForGas);
  
  return { coinForGas, coinForSwap };
}


// Prepares arguments for the swap based on direction
function prepareSwapArguments(tx: Transaction, poolState: any, swapParams: any, coinForSwap: any) {
  const coinA = poolState.coin_a.address;
  const coinB = poolState.coin_b.address;
  
  let coinAArg;
  let coinBArg;
  
  if (swapParams.aToB) {
    // For A→B swap: Use our SUI coin for A, create empty B coin to receive
    coinAArg = coinForSwap;
    coinBArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinB],
      arguments: [],
    });
    console.log("Coin B arguments -> ", coinBArg);
  } else {
    // For B→A swap: Create empty A coin to receive, use our SUI coin for B
    coinAArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinA],
      arguments: [],
    });
    coinBArg = coinForSwap;
  }
  
  return { coinA, coinB, coinAArg, coinBArg };
}

//Builds the swap transaction
function buildSwapTransaction(
  tx: Transaction,
  swapParams: any,
  config: any,
  coinA: string,
  coinB: string,
  coinAArg: any,
  coinBArg: any
) {
  tx.moveCall({
    // Bluefin DEX package ID
    package: config.CurrentPackage,
    module: "gateway",
    function: "swap_assets",
    arguments: [
      // Sui system clock object - required for time-based operations
      tx.object("0x6"),
      // Bluefin global configuration object
      tx.object(config.GlobalConfig),
      tx.object(swapParams.poolId),
      // Coin A - either our coin or an empty receiver depending on swap direction
      coinAArg,
      // Coin B - either our coin or an empty receiver depending on swap direction
      coinBArg,
      tx.pure.bool(swapParams.aToB),
      tx.pure.bool(swapParams.byAmountIn),
      tx.pure.u64(swapParams.amount),
      tx.pure.u64(swapParams.slippageProtection),
      tx.pure.u128(swapParams.maximumSqrt)
    ],
    // The specific coin types involved in this swap
    typeArguments: [
      coinA, // In this case: 0x2::sui::SUI
      coinB  // In this case: 0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
    ]
  });
}

//Sends transaction to Fordefi API
async function submitTransactionToFordefi(
  client: SuiClient,
  tx: Transaction,
  vault_id: string,
  accessToken: string
) {
  const bcsData = await tx.build({ client });
  const base64TxData = Buffer.from(bcsData).toString("base64");

  const requestBody = JSON.stringify(await formRequest(vault_id, base64TxData));
  const pathEndpoint = "/api/v1/transactions/create-and-wait";
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;
  const signature = await signWithApiSigner(payload);

  const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody);
  return response.data;
}

// Main swap function
export async function swapAssets(
  swapParams: any,
  accessToken: string,
  vault_id: string,
  senderAddress: string,
  client: SuiClient,
  config: any
) {
  // 1. Build the transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);
  tx.setGasOwner(senderAddress);
  tx.setGasBudget(10_000_000);
  tx.setGasPrice(1000);

  // 2. Select and prepare coins
  const { coinForGas, coinForSwap } = await selectCoins(client, senderAddress, swapParams.amount, tx);
  tx.setGasPayment([
    {
      objectId: coinForGas.coinObjectId,
      digest: coinForGas.digest,
      version: coinForGas.version,
    },
  ]);

  // 3. Query the pool details
  const qc = new QueryChain(client);
  const poolState = await qc.getPool(swapParams.poolId);

  // 4. Prepare arguments for the swap
  const { coinA, coinB, coinAArg, coinBArg } = prepareSwapArguments(tx, poolState, swapParams, coinForSwap);

  // 5. Build the swap transaction
  buildSwapTransaction(tx, swapParams, config, coinA, coinB, coinAArg, coinBArg);
  
  // 6. Submit transaction to Fordefi
  const fordDefiResult = await submitTransactionToFordefi(client, tx, vault_id, accessToken);
  console.log(fordDefiResult);

  // 7. Verify transaction success
  const sig = fordDefiResult.signatures[0];
  if (!sig) {
    throw new Error("Signature not returned from Fordefi!");
  }
  console.log("Transaction completed! ✅");
  
  return fordDefiResult;
}