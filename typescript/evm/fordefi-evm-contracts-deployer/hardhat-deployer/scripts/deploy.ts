import hre from "hardhat";
import { parseEther } from "viem";
import "@nomicfoundation/hardhat-ethers";
import { HttpNetworkUserConfig } from "hardhat/types";
import { FordefiWeb3Provider } from "@fordefi/web3-provider";

// FORDEFI secrets
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
  (() => { throw new Error('PEM_PRIVATE_KEY is not set') })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ?? 
(() => { throw new Error('FORDEFI_EVM_VAULT_ADDRESS is not set') })();

// Some vars for your contract
const JAN_1ST_2030 = 1893456000;
const ONE_GWEI: bigint = parseEther("0.001");

// Deploy function
async function main() {
    const networkConfig = hre.network.config as HttpNetworkUserConfig;
    const fordefiProvider = new FordefiWeb3Provider({
      address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`, // Your Fordefi EVM Vault address
      apiUserToken: FORDEFI_API_USER_TOKEN,
      apiPayloadSignKey: PEM_PRIVATE_KEY,
      chainId: networkConfig.chainId as number,
      rpcUrl: networkConfig.url,
    });
    const provider = new hre.ethers.BrowserProvider(fordefiProvider);
    const signer = await provider.getSigner();
    const factory = await hre.ethers.getContractFactory("Lock", signer);
    console.log('Deploying contract...');
    // Deploy contract with values. 
    const contract = await factory.deploy(JAN_1ST_2030, { value: ONE_GWEI });
    await contract.waitForDeployment();
    console.log('Contract deployed to:', await contract.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });

// Deploy command -> npx hardhat run --network polygon scripts/deploy.ts