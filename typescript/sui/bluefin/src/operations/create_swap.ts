import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot";
import { Transaction } from "@mysten/sui/transactions";
import { signWithApiSigner } from "../api_request/signer";
import { SuiClient } from "@firefly-exchange/library-sui";
import { createRequest } from "../api_request/form_request";
import { createAndSignTx } from "../api_request/pushToApi";
import { SwapParams } from '../interfaces/swapParams';


async function selectCoins(
  client: SuiClient,
  senderAddress: string,
  swapAmount: bigint, 
  tx: Transaction
) {
  // 1. We fetch all the coins from the wallet
  let allCoins = (await client.getCoins({
    owner: senderAddress,
    coinType: "0x2::sui::SUI",
  })).data;

  // We sort by descending balance
  allCoins.sort((a, b) => Number(b.balance) - Number(a.balance));
  console.log("My coins 🪙🪙 -> ", allCoins);

  if (allCoins.length === 0) {
    throw new Error("No SUI coins in the wallet 💸💸");
  }

  // 2. Our largest coin is allCoins[0]  and if we have at least 2 coins, "secondCoin" = allCoins[1].
  const largestCoin = allCoins[0];
  const secondCoin = allCoins.length >= 2 ? allCoins[1] : null;

  let coinForGas;
  let coinForSwap;

  // 3. Let's decide how to pick coinForGas and coinForSwap:
  //
  //    Case A: We have >= 2 coins AND the second coin has enough balance for the swap.
  //            In that scenario, we do NOT split, we just use the second coin for swapping.
  //
  //    Case B: We have >= 2 coins but second coin is too small to cover the swap amount.
  //            In this case we need to split from the largest coin in a single transaction.
  //
  //    Case C: We only have 1 coin in total, therefore split we must.

  const swapAmountNum = Number(swapAmount);
  const secondCoinBalance = secondCoin ? Number(secondCoin.balance) : 0;
  let isCaseA: boolean | undefined = undefined;

  if (allCoins.length >= 2 && secondCoinBalance >= swapAmountNum) {
    isCaseA = true
    // CASE A: no splitting needed
    console.log("Two coins are available and second coin is large enough for the swap.");
    coinForGas = largestCoin;
    coinForSwap = secondCoin;
  } else if (allCoins.length >= 2) {
    // CASE B: second coin is too small, we must do ephemeral splitting from largest
    isCaseA = false
    console.log("Second coin not sufficient let's split the largest coin inside this transaction 🪓🪓");
    // CASE B - 1) We set the gas payment to the largest coin
    tx.setGasPayment([
      {
        objectId: largestCoin.coinObjectId,
        digest: largestCoin.digest,
        version: largestCoin.version,
      },
    ]);
    // CASE B - 2) We create an ephemeral reference 
    const [splitCoinForSwap] = tx.splitCoins(tx.gas, [swapAmountNum]);
    // and we'll assign it for the swap
    coinForSwap = splitCoinForSwap;
    coinForGas = largestCoin; 
  } else {
    // CASE C: only 1 coin in total -> split we must
    isCaseA = false
    console.log("Only one coin in the wallet. We'll split it for swap + gas 🪓🪓🪓🪓");

    // CASE C - 1) We set the gas payment to that single coin
    tx.setGasPayment([
      {
        objectId: largestCoin.coinObjectId,
        digest: largestCoin.digest,
        version: largestCoin.version,
      },
    ]);

    // CASE C - 2) We split from the gas coin
    const [splitCoinForSwap] = tx.splitCoins(tx.gas, [swapAmountNum]);

    coinForGas = largestCoin; 
    coinForSwap = splitCoinForSwap; // that's our ephemeral reference
  }
  console.log("Coin for Swap", coinForSwap)

  // Return the coinForSwap references to the caller (can be either a normal coin object or an ephemeral reference)
  return { coinForSwap, isCaseA };
}


// Prepares arguments for the swap based on direction
function prepareSwapArguments(tx: Transaction, poolState: any, swapParams: SwapParams, coinForSwap: any, isCaseA: boolean) {
  const coinA = poolState.coin_a.address;
  const coinB = poolState.coin_b.address;
  
  let coinAArg;
  let coinBArg;
  
  if (swapParams.aToB) {
    // For A→B swap
    coinAArg = isCaseA ? tx.object(coinForSwap.coinObjectId) : coinForSwap;
    coinBArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinB],
      arguments: [],
    });
  } else {
    // For B→A swap
    coinAArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinA],
      arguments: [],
    });
    coinBArg = isCaseA ? tx.object(coinForSwap.coinObjectId) : coinForSwap;
  }
  return { coinA, coinB, coinAArg, coinBArg };
}

// Builds the swap transaction
function buildSwapTransaction(
  tx: Transaction,
  swapParams: any,
  config: any,
  coinA: any,
  coinB: any,
  coinAArg: any,
  coinBArg: any
) {
  console.log("CoinA Args ->", coinAArg)
  console.log("CoinB Args ->", coinBArg)
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

  const requestBody = JSON.stringify(await createRequest(vault_id, base64TxData));
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
  tx.setSender(senderAddress);            // The address initiating the transaction
  tx.setGasOwner(senderAddress);          // The address paying for gas
  tx.setGasBudget(swapParams.gasBudget);  
  tx.setGasPrice(swapParams.gasPrice);           

  // 2. Select and prepare coins
  const { coinForSwap, isCaseA } = await selectCoins(client, senderAddress, swapParams.amount, tx);

  // 3. Query the pool details
  const qc = new QueryChain(client);
  const poolState = await qc.getPool(swapParams.poolId);

  // 4. Prepare arguments for the swap
  const { coinA, coinB, coinAArg, coinBArg } = prepareSwapArguments(tx, poolState, swapParams, coinForSwap, isCaseA);

  // 5. Build the swap transaction
  const builtTx  = buildSwapTransaction(tx, swapParams, config, coinA, coinB, coinAArg, coinBArg);
  console.log(builtTx)
  
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