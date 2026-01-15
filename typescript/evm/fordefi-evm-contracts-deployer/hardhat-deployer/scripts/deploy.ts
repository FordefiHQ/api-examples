import fs from 'fs';
import hre from "hardhat";
import dotenv from 'dotenv';
import { ethers } from "ethers";
import { getProvider } from "./get-provider.js";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

dotenv.config()

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ??
(() => { throw new Error('FORDEFI_API_USER_TOKEN is not set') })();
const privateKeyFilePath = './fordefi_secret/private.pem';
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, 'utf8') ??
(() => { throw new Error('PEM_PRIVATE_KEY is not set') })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
(() => { throw new Error('FORDEFI_EVM_VAULT_ADDRESS is not set') })();

const fordefiConfig: FordefiProviderConfig = {
    address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
    apiUserToken: FORDEFI_API_USER_TOKEN,
    apiPayloadSignKey: PEM_PRIVATE_KEY,
    chainId: 8453,
    rpcUrl: "https://base-rpc.publicnode.com",
};

async function main() {
    let provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");
    const web3Provider = new ethers.BrowserProvider(provider);

    const signer = await web3Provider.getSigner();
    const artifact = await hre.artifacts.readArtifact("Token");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    console.log('Deploying Token contract...');

    // Deploy with constructor args: name, symbol, decimals, initialSupply
    const contract = await factory.deploy(
        "FordefiToken",           // name
        "FRDFI",               // symbol
        18,                  // decimals
        ethers.parseEther("1000000") // initial supply: 1 million tokens
    );
    await contract.waitForDeployment();
    console.log('Token deployed to:', await contract.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
