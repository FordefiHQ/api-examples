import { OrderBookApi, OrderSigningUtils, SigningScheme } from '@cowprotocol/cow-sdk'
import { EvmChainId } from '@fordefi/web3-provider';
import { approveGPv2VaultRelayer } from './get-appproval'
import { getProvider } from './get-provider';
import { fordefiConfig, quoteRequest } from './config'

// Init CowSwap orderbook
const orderBookApi = new OrderBookApi({ chainId: EvmChainId.NUMBER_1 });
const GPv2VaultRelayer = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";

async function main() {
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }
  const signer = provider.getSigner();

  // Approve GPv2VaultRelayer to spend tokens
  await approveGPv2VaultRelayer(signer, quoteRequest.sellToken, GPv2VaultRelayer );

  // Request quote from CowSwap
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log("Your quote is", quote);
  
  const unsignedQuote = {
    ...quote,
    receiver: quote.receiver || fordefiConfig.address, 
  };
  
  // Sign quote with Fordefi
  const signedQuote = await OrderSigningUtils.signOrder(unsignedQuote, EvmChainId.NUMBER_1, signer);
  console.log("Your signed quote is", signedQuote);

  // Created swap order
  const orderCreation = {
    ...quote,
    signature: signedQuote.signature,
    signingScheme: signedQuote.signingScheme as unknown as SigningScheme,
  };
  // Override the feeAmount to 0 before sending the order to avoid 'Fee must be zero' errors from the CowSwap API
  orderCreation.feeAmount = '0';
  console.log("Modified order with zero fee:", orderCreation);

  // Send order to CowSwap for execution
  const orderId = await orderBookApi.sendOrder(orderCreation);
  console.log("Your order is", orderCreation);

  const order = await orderBookApi.getOrder(orderId);
  console.log("Order on chain:", order)
}

main().catch(console.error);