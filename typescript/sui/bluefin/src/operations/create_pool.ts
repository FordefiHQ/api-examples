import { Transaction as TransactionBlock } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { SuiClient } from "@mysten/sui/client";
import * as classes_1 from "@firefly-exchange/library-sui/dist/src/classes";
import { signWithApiSigner } from "../api_request/signer";
import { formRequest } from "../api_request/form_request";
import { createAndSignTx } from "../api_request/pushToApi";


function asUintN(int: any, bits = 32) {
  return BigInt.asUintN(bits, BigInt(int)).toString();
}

function _openPositionInternal(
  globalConfig: string,
  currentPackage: string,
  pool: any,
  coin_a: string,
  coin_b: string,
  lowerTick: any,
  upperTick: any,
  options: any
) {
  const txb = options.txb;
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

async function _provideLiquidityFixedAmountInternal(
  globalConfig: string,
  currentPackage: string,
  senderAddress: string,
  pool: any,
  coin_a: string,
  coin_b: string,
  position: any,
  liquidityInput: any,
  options: any,
  client: SuiClient
) {
  const txb = options.txb;
  const sender = senderAddress
  const [amountAMax, amountBMax] = liquidityInput.fix_amount_a
    ? [liquidityInput.coinAmount, liquidityInput.tokenMaxB]
    : [liquidityInput.tokenMaxA, liquidityInput.coinAmount];
  const amount = liquidityInput.coinAmount;
  const [splitCoinA, mergeCoinA] =
    await classes_1.CoinUtils.createCoinWithBalance(
      client,
      txb,
      amountAMax.toString(),
      coin_a,
      senderAddress
    );
  const [splitCoinB, mergeCoinB] =
    await classes_1.CoinUtils.createCoinWithBalance(
      client,
      txb,
      amountBMax.toString(),
      coin_b,
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
  // merge the remaining coins and send them all back to user
  const coins: any[] = [];
  [mergeCoinA, mergeCoinB].forEach((item) => {
    if (item) {
      coins.push(item);
    }
  });
  if (coins.length > 0) {
    txb.transferObjects(coins, sender);
  }
  return txb;
}

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
  
  const pool = config.Pools[0].id
  console.log("Pool -> ", pool)
  const globalConfig =  config.GlobalConfig
  console.log("Global config -> ", globalConfig)
  const currentPackage = config.CurrentPackage
  console.log("Current package -> ", currentPackage)
  const senderAddress = fordefiConfig.senderAddress
  console.log("Sender address -> ", senderAddress)
  const coinA = config.Pools[0].coinA
  console.log("CoinA -> ", coinA)
  const coinB = config.Pools[0].coinB
  console.log("CoinB -> ", coinB)

  let txb = new TransactionBlock();
  const result = _openPositionInternal(globalConfig, currentPackage, pool, coinA, coinB, params.lowerTick, params.upperTick, {
    txb,
  });
  txb = result.txb;
  const position = result.position;
  txb = await _provideLiquidityFixedAmountInternal(
    globalConfig,
    currentPackage,
    senderAddress,  
    pool,          
    coinA,          
    coinB,         
    position,
    params,
    {
      txb,
    },
    client
  );

  txb.transferObjects([position], senderAddress);
  txb.setGasBudget(100000000);
  txb.setSender(senderAddress);

  console.log("Using sender address:", senderAddress);

  const bcsData = await txb.build({ client: client });
  const bcsBase64 = Buffer.from(bcsData).toString("base64");

  // 9. Prepare request body for Fordefi custody service
  const fordefiVault = fordefiConfig.vaultId; // Vault ID in Fordefi
  const requestBody = JSON.stringify(await formRequest(fordefiVault, bcsBase64));

  // 10. Create signature for Fordefi API authentication
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