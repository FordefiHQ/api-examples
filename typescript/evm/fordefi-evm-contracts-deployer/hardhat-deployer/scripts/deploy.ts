import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import "@nomicfoundation/hardhat-ethers";
import { getProvider } from "./get-provider";
import { HttpNetworkUserConfig } from "hardhat/types";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config()

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
(() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
(() => { throw new Error('PEM_PRIVATE_KEY is not set') })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ?? 
(() => { throw new Error('FORDEFI_EVM_VAULT_ADDRESS is not set') })();

const networkConfig = hre.network.config as HttpNetworkUserConfig;
const config: FordefiProviderConfig = {
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: networkConfig.chainId as number,
    rpcUrl: networkConfig.url,
};

async function main() {
    let provider = await getProvider(config);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new hre.ethers.BrowserProvider(provider); 
  
    const signer = await web3Provider.getSigner();
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