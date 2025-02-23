import { FordefiWeb3Provider, EvmChainId, FordefiProviderConfig } from '@fordefi/web3-provider';
import { OrderBookApi, OrderSigningUtils, OrderQuoteRequest, OrderQuoteSideKindSell, SigningScheme } from '@cowprotocol/cow-sdk'
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs'

// Load FORDEFI secrets
dotenv.config()
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
  (() => { throw new Error('PEM_PRIVATE_KEY is not set') })();

// Init Fordefi Provider
const config: FordefiProviderConfig = {
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  chainId: EvmChainId.NUMBER_1, // Mainnet
  rpcUrl: "https://ethereum-rpc.publicnode.com",
};
const fordefiProvider = new FordefiWeb3Provider(config);
const provider = new ethers.providers.Web3Provider(fordefiProvider)

// Prepare CowSwap quote
const quoteRequest: OrderQuoteRequest = {
  sellToken: '0xC4441c2BE5d8fA8126822B9929CA0b81Ea0DE38E', // $USUAL token
  buyToken: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT token
  from: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  receiver: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73",
  sellAmountBeforeFee: (1_000_000_000_000 * 18 ** 6).toString(),
  kind: OrderQuoteSideKindSell.SELL,
  signingScheme: SigningScheme.EIP712
}

// Init CowSwap orderbook
const orderBookApi = new OrderBookApi({ chainId: EvmChainId.NUMBER_1 })

async function main() {
  // Request quote from CowSwap
  const { quote } = await orderBookApi.getQuote(quoteRequest)
  console.log("Your quote is", quote);
  
  const unsignedQuote = {
    ...quote,
    receiver: quote.receiver || config.address, 
  };
  
  // Sign quote with Fordefi
  const signer = provider.getSigner();
  const signedQuote = await OrderSigningUtils.signOrder(unsignedQuote, EvmChainId.NUMBER_1, signer);
  console.log("Your signed quote is", signedQuote);

  // Created swap order
  const orderCreation = {
    ...quote,
    signature: signedQuote.signature,
    signingScheme: signedQuote.signingScheme as unknown as SigningScheme,
  };
  console.log("Your order creation request is", orderCreation);

  // Send order to CowSwap for execution
  const orderId = await orderBookApi.sendOrder(orderCreation);
  const order = await orderBookApi.getOrder(orderId)
  console.log("Your order is", orderCreation);
}

main().catch(console.error);