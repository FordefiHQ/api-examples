import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot";
import { Transaction } from "@mysten/sui/transactions";
import { signWithApiSigner } from "../api_request/signer";
import { SuiClient } from "@firefly-exchange/library-sui";
import { formRequest } from "../api_request/form_request";
import { createAndSignTx } from "../api_request/pushToApi";


export async function swapAssets(
  swapParams: any,
  accessToken: string,
  vault_id: string,
  senderAddress: string,
  client: SuiClient,
  config: any
) {

  // 1. Build the swap transaction
  const tx = new Transaction();

  tx.setSender(senderAddress);      // The address initiating the transaction
  tx.setGasOwner(senderAddress)     // The address paying for gas
  tx.setGasBudget(10_000_000);      // Maximum gas allowed for this transaction
  tx.setGasPrice(1000);             // Price per gas unit in MIST

  // 2. Sorting out SUI coins (we're swapping SUI here )
  let allCoins = (await client.getCoins({
    owner: senderAddress,
    coinType: "0x2::sui::SUI",
  })).data;
  allCoins.sort((a, b) => Number(b.balance) - Number(a.balance));
  console.log("My coins 🪙🪙 -> ", allCoins)

  let coinForGas: any;
  let coinForSwap: any;
  if (allCoins.length >= 2) {
    // Use largest for gas, the second largest for swap
    coinForGas = allCoins[0];
    coinForSwap = allCoins[1];
  } else {
    // Only 1 coin let's split it!
    console.log("Only one coin in wallet, let's split it! 🪓🪓")
    coinForGas = allCoins[0];
    if (!coinForGas) {
      throw new Error("No SUI coins found to pay for gas.");
    }
  }
  if (!coinForSwap) {
    [coinForSwap] = tx.splitCoins(tx.gas, [swapParams.amount]);
  }
  console.log("Coin for swap 🤝 -> ", coinForSwap)
  console.log("Coin for gas ⛽ -> ", coinForGas)

  // We specify which coin object pays for gas
  tx.setGasPayment([
    {
      objectId: coinForGas.coinObjectId,
      digest: coinForGas.digest,
      version: coinForGas.version,
    },
  ]);

  // 3. Query the pool details to get information about the trading pair
  const qc = new QueryChain(client);
  const poolState = await qc.getPool(swapParams.poolId);
  console.log("DEBUG - PoolState: ", poolState);
  console.log("check")

  // 5. Extract coin types from pool state
  const coinA = poolState.coin_a.address
  const coinB = poolState.coin_b.address
  
  // 6. Prepare arguments for the swap based on direction (A→B or B→A)
  let coinAArg;
  let coinBArg;
  if (swapParams.aToB) {
    // For A→B swap: Use our SUI coin for A, create empty B coin to receive
    coinAArg = coinForSwap
    coinBArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinB],
      arguments: [],
    });
    console.log("Coin B arguments -> ", coinBArg)
  } else {
    // For B→A swap: Create empty A coin to receive, use our SUI coin for B
    coinAArg = tx.moveCall({
      package: "0x2",
      module: "coin",
      function: "zero",
      typeArguments: [coinA],
      arguments: [],
    });
    coinAArg = coinForSwap
  }
  // 7. Construct the swap function call
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
  console.log("DEBUG - Transaction before BCS -> ", tx.getData())
  
  // 8. Serialize the transaction to binary format (BCS)
  const bcsData = await tx.build({ client });
  // Convert binary data to base64 for Fordefi API
  const base64TxData = Buffer.from(bcsData).toString("base64");

  // 9. Prepare request body for Fordefi custody service
  const requestBody = JSON.stringify(await formRequest(vault_id, base64TxData));

  // 10. Create signature for Fordefi API authentication
  const pathEndpoint = "/api/v1/transactions/create-and-wait";
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;
  const signature = await signWithApiSigner(payload);

  // 11. Submit the transaction to Fordefi API and wait for result
  const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody);
  const fordDefiResult = response.data;
  console.log(fordDefiResult)

  // 12. Verify transaction success
  const sig = fordDefiResult.signatures[0];
  if (!sig) {
    throw new Error("Signature not returned from Fordefi!");
  }
  console.log("Transaction completed! ✅");
}