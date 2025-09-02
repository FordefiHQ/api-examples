import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-ethers";
import { HttpNetworkUserConfig } from "hardhat/types";
import { FordefiWeb3Provider } from "@fordefi/web3-provider";

dotenv.config()

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
  (() => { throw new Error('PEM_PRIVATE_KEY is not set') })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ?? 
(() => { throw new Error('FORDEFI_EVM_VAULT_ADDRESS is not set') })();

const networkConfig = hre.network.config as HttpNetworkUserConfig;
const fordefiProvider = new FordefiWeb3Provider({
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: networkConfig.chainId as number,
    rpcUrl: networkConfig.url,
  });

async function main() {
    const provider = new hre.ethers.BrowserProvider(fordefiProvider);
    const signer = await provider.getSigner();
    const factory = await hre.ethers.getContractFactory("Greeter", signer);
    console.log('Deploying contract...');

    const contract = await factory.deploy();
    await contract.waitForDeployment();
    console.log('Contract deployed to:', await contract.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });