import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config();

function getChainId(chainName: string): number {
  switch (chainName) {
    case 'Ethereum':
      return 1;
    case 'Base':
      return 8453;
    case 'Arbitrum':
      return 42161;
    case 'Optimism':
      return 10;
    case 'Polygon':
      return 137;
    default:
      throw new Error(`Unsupported chain: ${chainName}`);
  }
}

export const bridgeCongfig = {
  chainFrom: 'Base',
  chainTo: 'Ethereum',
  destinationAddress: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73',
  amount: '10'
};

export const fordefiConfigFrom: FordefiProviderConfig = {
    chainId: getChainId(bridgeCongfig.chainFrom),
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73',
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://eth.llamarpc.com'
};

export const fordefiConfigTo: FordefiProviderConfig = {
    chainId: getChainId(bridgeCongfig.chainTo),
    address: bridgeCongfig.destinationAddress as `0x${string}`,
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://base.llamarpc.com'
};