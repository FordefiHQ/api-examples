import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs'

dotenv.config();

interface EIP712TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    MyStruct: Array<{
      name: string;
      type: string;
    }>;
  };
  message: {
    someValue: string;
    someString: string;
  };
}

export const fordefiConfig: FordefiProviderConfig = {
    chainId: 1,
    address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the message
    apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
    apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
    rpcUrl: 'https://eth.llamarpc.com',
    skipPrediction: true
};
  
export const eip712TypedData: EIP712TypedData = {
  domain: {
    name: 'HelloDapp',                                                // Human-readable name of your domain
    version: '1',                                                     // Version of your domain
    chainId: Number(fordefiConfig.chainId),                           // EVM chain ID
    verifyingContract: '0x28A2b192810484C19Dd3c8884f0F30AfE4796ad7',  // Contract that will verify the signature
  },
  
  types: {
    MyStruct: [
      { name: 'someValue', type: 'uint256' },
      { name: 'someString', type: 'string' },
    ],
  },
  
  message: {
    someValue: '12345',
    someString: 'Go go Fordefi!',
  }
};