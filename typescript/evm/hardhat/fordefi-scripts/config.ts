import { FordefiProviderConfig } from '@fordefi/web3-provider';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configure the Fordefi provider
export const fordefiConfig: FordefiProviderConfig = {
  chainId: 31337, // Hardhat
  address: '0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73', // The Fordefi EVM Vault that will sign the txs
  apiUserToken: process.env.FORDEFI_API_USER_TOKEN ?? (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set'); })(), 
  apiPayloadSignKey: fs.readFileSync('./fordefi_secret/private.pem', 'utf8') ?? (() => { throw new Error('PEM_PRIVATE_KEY is not set'); })(),
  rpcUrl: process.env.NGROK_ENDPOINT,
  skipPrediction: false 
};

export const callConfig = {
  contractAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // demo contract address
  hex_call_data: "0x371303c0" // calls inc() on the demo contract
}