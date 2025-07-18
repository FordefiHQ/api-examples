import { OrderBookApi, OrderSigningUtils, SigningScheme, UnsignedOrder, SupportedChainId} from '@cowprotocol/cow-sdk'
import { fordefiConfig, quoteRequest, vaultRelayers } from './config'
import { approveGPv2VaultRelayer } from './get-appproval'
import { getProvider } from './get-provider';

// Init CowSwap orderbook
const evmChainId = fordefiConfig.chainId as SupportedChainId // Base
const orderBookApi = new OrderBookApi({ chainId: evmChainId });
const GPv2VaultRelayer = vaultRelayers.base;

async function main() {
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }
  const signer = provider.getSigner();

  // Approve GPv2VaultRelayer to spend tokens
  await approveGPv2VaultRelayer(provider, signer, quoteRequest.sellToken, GPv2VaultRelayer );

  // Request quote from CowSwap
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log("Your quote is", quote);
  
  // NOTE: We override the feeAmount to 0 before signing the order to avoid 'Fee must be zero' errors from the CowSwap API
  const unsignedQuote: UnsignedOrder = {
    ...quote,
    sellAmount: quote.sellAmount,
    feeAmount: '0',
    receiver: quote.receiver || fordefiConfig.address, 
  };
  
  // Sign quote with Fordefi
  let signedQuote;
  try {
    signedQuote = await OrderSigningUtils.signOrder(unsignedQuote, evmChainId, signer);
  } catch (err) {
    console.error('❌  OrderSigningUtils.signOrder threw:', err);
    throw err;
  }
  console.log('Your signed quote is', signedQuote);

  const orderId = await orderBookApi.sendOrder({
    ...quote,
    ...signedQuote,
    sellAmount: unsignedQuote.sellAmount, // replace quote sellAmount with signed order sellAmount, which is equal to original sellAmount
    feeAmount: unsignedQuote.feeAmount, // replace quote feeAmount with signed order feeAmount, which is 0
    signingScheme: signedQuote.signingScheme as unknown as SigningScheme
  })
  console.log("Your order is", orderId);

  const order = await orderBookApi.getOrder(orderId);
  console.log("Order on chain:", order)
}

main().catch(console.error);