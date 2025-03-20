import { Transaction as TransactionBlock } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import * as classes_1 from "@firefly-exchange/library-sui/dist/src/classes";
import { signWithApiSigner } from "../api_request/signer";
import { createRequest } from "../api_request/form_request";
import { createAndSignTx } from "../api_request/pushToApi";

// Helper function to convert a number to uint of 32-bit length
function asUintN(int: any, bits = 32) {
  return BigInt.asUintN(bits, BigInt(int)).toString();
}

// Helper function to create transaction block if not provided
function getOrCreateTxBlock(options: any) {
  return options.txb || new TransactionBlock();
}

// Separate position creation functionality
function _openPositionInternal(
  globalConfig: string,
  currentPackage: string,
  pool: string,
  coin_a: string,
  coin_b: string,
  lowerTick: any,
  upperTick: any,
  options: any
) {
  const txb = getOrCreateTxBlock(options);
  const tickLowerBits = Number(asUintN(BigInt(lowerTick)).toString());
  const tickUpperBits = Number(asUintN(BigInt(upperTick)).toString());
  const [position] = txb.moveCall({
    arguments: [
      txb.object(globalConfig),
      txb.object(pool),
      txb.pure.u32(tickLowerBits),
      txb.pure.u32(tickUpperBits),
    ],
    target: `${currentPackage}::pool::open_position`,
    typeArguments: [coin_a, coin_b],
  });
  return { txb, position };
}

// Create coins with required balances
async function prepareLiquidityCoins(
  client: SuiClient,
  txb: TransactionBlock,
  coin_a: string,
  coin_b: string,
  amountAMax: any,
  amountBMax: any,
  senderAddress: string
) {
  const [splitCoinA, mergeCoinA] = await classes_1.CoinUtils.createCoinWithBalance(
    client,
    txb,
    amountAMax.toString(),
    coin_a,
    senderAddress
  );
  
  const [splitCoinB, mergeCoinB] = await classes_1.CoinUtils.createCoinWithBalance(
    client,
    txb,
    amountBMax.toString(),
    coin_b,
    senderAddress
  );

  return {
    splitCoinA,
    splitCoinB,
    mergeCoins: [mergeCoinA, mergeCoinB].filter(Boolean)
  };
}

// Provide liquidity with fixed amount
async function _provideLiquidityFixedAmountInternal(
  globalConfig: string,
  currentPackage: string,
  senderAddress: string,
  pool: string,
  coin_a: string,
  coin_b: string,
  position: any,
  liquidityInput: any,
  options: any,
  client: SuiClient
) {
  const txb = getOrCreateTxBlock(options);
  const [amountAMax, amountBMax] = liquidityInput.fix_amount_a
    ? [liquidityInput.coinAmount, liquidityInput.tokenMaxB]
    : [liquidityInput.tokenMaxA, liquidityInput.coinAmount];
  const amount = liquidityInput.coinAmount;
  
  const { splitCoinA, splitCoinB, mergeCoins } = await prepareLiquidityCoins(
    client,
    txb,
    coin_a,
    coin_b,
    amountAMax,
    amountBMax,
    senderAddress
  );

  txb.moveCall({
    arguments: [
      txb.object(SUI_CLOCK_OBJECT_ID),
      txb.object(globalConfig),
      txb.object(pool),
      txb.object(position),
      txb.object(splitCoinA),
      txb.object(splitCoinB),
      txb.pure.u64(amount.toString()),
      txb.pure.u64(amountAMax.toString()),
      txb.pure.u64(amountBMax.toString()),
      txb.pure.bool(liquidityInput.fix_amount_a),
    ],
    target: `${currentPackage}::gateway::provide_liquidity_with_fixed_amount`,
    typeArguments: [coin_a, coin_b],
  });
  
  // Return remaining coins to user
  if (mergeCoins.length > 0) {
    txb.transferObjects(mergeCoins, senderAddress);
  }
  
  return txb;
}

// Extract pool configuration gathering
function getPoolConfiguration(config: any) {
  const poolIndex = 3; // SUI / USDC Pool in this example
  
  return {
    pool: config.Pools[poolIndex].id,
    globalConfig: config.GlobalConfig,
    currentPackage: config.CurrentPackage,
    coinA: config.Pools[poolIndex].coinA,
    coinB: config.Pools[poolIndex].coinB
  };
}

// Handle Fordefi API operations
async function processFordefiTransaction(txb: TransactionBlock, client: SuiClient, fordefiConfig: any) {
  const bcsData = await txb.build({ client: client });
  const bcsBase64 = Buffer.from(bcsData).toString("base64");

  // Prepare request body for Fordefi custody service
  const fordefiVault = fordefiConfig.vaultId; 
  const requestBody = JSON.stringify(await createRequest(fordefiVault, bcsBase64));

  // Create signature for Fordefi API authentication
  const pathEndpoint = "/api/v1/transactions/create-and-wait";
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;
  const signature = await signWithApiSigner(payload);

  try {
    const response = await createAndSignTx(pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    
    console.log("Response received:", Object.keys(response));
    
    if (!response || !response.data) {
      throw new Error("Invalid response received from Fordefi API");
    }

    const fordDefiResult = response.data;
    console.log(fordDefiResult)

    const sig = fordDefiResult?.signatures?.[0];
    if (!sig) {
      throw new Error("Signature not returned from Fordefi!");
    }
    console.log("Transaction completed! ✅");
    
  } catch (error) {
    console.error("Error processing Fordefi transaction:", error);
    throw error; 
  }
}

// Main function
export async function openPositionWithFixedAmount(
  config: any,
  params: any,
  fordefiConfig: {
    accessToken: string;
    privateKeyPath: string;
    vaultId: string;
    network: "mainnet" | "testnet";
    senderAddress: string;
  },
  client: SuiClient
) {
  const { pool, globalConfig, currentPackage, coinA, coinB } = getPoolConfiguration(config);
  const senderAddress = fordefiConfig.senderAddress;
  
  // Log configuration values
  console.log("Pool -> ", pool);
  console.log("Global config -> ", globalConfig);
  console.log("Current package -> ", currentPackage);
  console.log("Sender address -> ", senderAddress);
  console.log("CoinA -> ", coinA);
  console.log("CoinB -> ", coinB);

  // Create transaction
  let txb = new TransactionBlock();
  
  // Open position
  const result = _openPositionInternal(
    globalConfig, 
    currentPackage, 
    pool, 
    coinA, 
    coinB, 
    params.lowerTick, 
    params.upperTick, 
    { txb }
  );
  txb = result.txb;
  const position = result.position;
  
  // Provide liquidity
  txb = await _provideLiquidityFixedAmountInternal(
    globalConfig,
    currentPackage,
    senderAddress,  
    pool,          
    coinA,          
    coinB,         
    position,
    params,
    { txb },
    client
  );

  // Finalize transaction
  txb.transferObjects([position], senderAddress);
  txb.setGasBudget(100000000);
  txb.setSender(senderAddress);

  console.log("Using sender address:", senderAddress);

  // Process with Fordefi
  return await processFordefiTransaction(txb, client, fordefiConfig);
}