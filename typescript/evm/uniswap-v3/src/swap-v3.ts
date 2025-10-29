import JSBI from 'jsbi';
import { ethers } from 'ethers';
import { getProvider } from './get-provider';
import { fromReadableAmount } from './helper';
import { CurrentConfig, fordefiConfig } from './config';
import { ERC20_ABI, V3_SWAP_ROUTER_ADDRESS } from './constants';
import { ChainId, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core'
import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router';


async function main() {
  console.log('🔄 Starting Uniswap V3 Token Swap...\n');
  
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }
  
  const signer = provider.getSigner();
  const walletAddress = await signer.getAddress();
  
  // Display swap configuration
  console.log('📋 Swap Configuration:');
  console.log(`From: ${CurrentConfig.tokens.in.symbol} (${CurrentConfig.tokens.in.address})`);
  console.log(`To: ${CurrentConfig.tokens.out.symbol} (${CurrentConfig.tokens.out.address})`);
  console.log(`Amount In: ${CurrentConfig.tokens.amountIn} ${CurrentConfig.tokens.in.symbol}`);
  console.log(`Slippage: ${Number(CurrentConfig.slippage.slippageAmount) / 100}%`);
  console.log(`Wallet: ${walletAddress}\n`);
  
  // Check token balances
  console.log('💰 Checking token balances...');
  const tokenInContract = new ethers.Contract(CurrentConfig.tokens.in.address, ERC20_ABI, signer);
  const tokenOutContract = new ethers.Contract(CurrentConfig.tokens.out.address, ERC20_ABI, signer);
  
  const [balanceIn, balanceOut] = await Promise.all([
    tokenInContract.balanceOf(walletAddress),
    tokenOutContract.balanceOf(walletAddress)
  ]);
  
  console.log(`${CurrentConfig.tokens.in.symbol} balance: ${ethers.utils.formatUnits(balanceIn, CurrentConfig.tokens.in.decimals)}`);
  console.log(`${CurrentConfig.tokens.out.symbol} balance: ${ethers.utils.formatUnits(balanceOut, CurrentConfig.tokens.out.decimals)}\n`);

  // Invoke Uniswap router
  console.log('🔍 Finding best route...');
  const router = new AlphaRouter({
    chainId: ChainId.MAINNET,
    provider,
  });

  // Define swap and token amount
  const options: SwapOptionsSwapRouter02 = {
    recipient: CurrentConfig.wallet?.address || fordefiConfig.address,
    slippageTolerance: new Percent(CurrentConfig.slippage.slippageAmount, 10_000), // define slippage in bps - 1% in this example
    deadline: Math.floor(Date.now() / 1000 + 1800),
    type: SwapType.SWAP_ROUTER_02,
  };
  const rawTokenAmountIn: JSBI = fromReadableAmount(
    CurrentConfig.tokens.amountIn,
    CurrentConfig.tokens.in.decimals
  );

  // Find route for swap
  const route = await router.route(
    CurrencyAmount.fromRawAmount(
      CurrentConfig.tokens.in,
      rawTokenAmountIn
    ),
    CurrentConfig.tokens.out,
    TradeType.EXACT_INPUT,
    options
  )
  if (!route) {
    throw new Error('No route found by the AlphaRouter');
  }
  
  // Display route details
  console.log('✅ Route found!');
  console.log(`Quote: ${route.quote.toFixed()} ${CurrentConfig.tokens.out.symbol}`);
  console.log(`Expected Output: ${route.quote.toSignificant(6)} ${CurrentConfig.tokens.out.symbol}`);
  console.log(`Gas Estimate: ${route.estimatedGasUsed.toString()}`);
  console.log(`Gas Cost (USD): $${route.gasPriceWei ? route.estimatedGasUsedUSD.toFixed(2) : 'N/A'}`);
  console.log(`Route: ${route.route.map((r: any) => r.protocol).join(' -> ')}\n`);

  // Check and approve tokens if needed
  console.log('✅ Checking token approval...');
  const tokenContract = new ethers.Contract(
    CurrentConfig.tokens.in.address, 
    ERC20_ABI, 
    signer
  );
  
  const currentAllowance = await tokenContract.allowance(walletAddress, V3_SWAP_ROUTER_ADDRESS);
  const requiredAmount = ethers.BigNumber.from(rawTokenAmountIn.toString());
  
  if (currentAllowance.lt(requiredAmount)) {
    console.log(`Approving ${CurrentConfig.tokens.in.symbol}...`);
    const approveTx = await tokenContract.approve(V3_SWAP_ROUTER_ADDRESS, requiredAmount);
    console.log(`Approval transaction: ${approveTx.hash}`);
    await approveTx.wait();
    console.log(`${CurrentConfig.tokens.in.symbol} approved ✅\n`);
  } else {
    console.log(`${CurrentConfig.tokens.in.symbol} already has sufficient allowance ✅\n`);
  }

  // Prepare transaction
  console.log('🎯 Transaction Details:');
  console.log(`Router: ${V3_SWAP_ROUTER_ADDRESS}`);
  console.log(`Value: ${ethers.utils.formatEther(route?.methodParameters?.value || 0)} ETH`);
  console.log(`Calldata length: ${route?.methodParameters?.calldata?.length || 0} bytes\n`);
  
  // Get gas information
  console.log('⛽ Fetching gas prices...');
  const feeData = await provider.getFeeData();
  const baseFee = feeData.lastBaseFeePerGas || ethers.utils.parseUnits('25', 'gwei');
  const priorityFee = ethers.utils.parseUnits('2', 'gwei');
  const maxFeePerGas = baseFee.mul(2).add(priorityFee);
  
  console.log(`Current base fee: ${ethers.utils.formatUnits(baseFee, 9)} Gwei`);
  console.log(`Priority fee: ${ethers.utils.formatUnits(priorityFee, 9)} Gwei`);
  console.log(`Max fee per gas: ${ethers.utils.formatUnits(maxFeePerGas, 9)} Gwei\n`);

  const value = route?.methodParameters?.value;

  // Sending swap transaction to Fordefi for signing and broadcast to blockchain
  console.log('📤 Sending swap transaction...');
  const txRes = await signer.sendTransaction({
    data: route?.methodParameters?.calldata,
    to: V3_SWAP_ROUTER_ADDRESS,
    value: value,
    from: fordefiConfig.address,
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee,
    gasLimit: 400_000,
  });
  
  console.log(`Transaction hash: ${txRes.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await txRes.wait();
  
  if (!receipt || receipt.status === 0) {
    throw new Error('Transaction failed');
  }
  
  console.log(`\n✅ Swap successful!`);
  console.log(`Block number: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`Effective gas price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice, 9)} Gwei`);
  
  // Check final balances
  console.log('\n💰 Final balances:');
  const [finalBalanceIn, finalBalanceOut] = await Promise.all([
    tokenInContract.balanceOf(walletAddress),
    tokenOutContract.balanceOf(walletAddress)
  ]);
  
  console.log(`${CurrentConfig.tokens.in.symbol}: ${ethers.utils.formatUnits(finalBalanceIn, CurrentConfig.tokens.in.decimals)}`);
  console.log(`${CurrentConfig.tokens.out.symbol}: ${ethers.utils.formatUnits(finalBalanceOut, CurrentConfig.tokens.out.decimals)}`);
  
  // Calculate actual amounts swapped
  const amountInUsed = balanceIn.sub(finalBalanceIn);
  const amountOutReceived = finalBalanceOut.sub(balanceOut);
  
  console.log(`\n📊 Swap Summary:`);
  console.log(`Sent: ${ethers.utils.formatUnits(amountInUsed, CurrentConfig.tokens.in.decimals)} ${CurrentConfig.tokens.in.symbol}`);
  console.log(`Received: ${ethers.utils.formatUnits(amountOutReceived, CurrentConfig.tokens.out.decimals)} ${CurrentConfig.tokens.out.symbol}`);
  console.log('\n✨🦄 Done!');
};
main().catch(console.error);
