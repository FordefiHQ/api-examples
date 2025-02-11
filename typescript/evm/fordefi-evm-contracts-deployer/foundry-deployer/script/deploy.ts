import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import {
  FordefiWeb3Provider,
  FordefiProviderConfig
} from "@fordefi/web3-provider";
import { ethers } from "ethers";


// 1. Configure your Fordefi secrets
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const privateKeyFilePath = "./fordefi_secret/private.pem";
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();


// 2. Chain ID configuration
//    Example: deploying on Polygon Mainnet (chainId=137)
const chainId = 137;


// 3. Construct FordefiWeb3Provider config
const config: FordefiProviderConfig = {
  chainId,
  address: "0x...", // Your Fordefi EVM Vault address
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: "https://polygon-rpc.com/" // Fallback RPC
};

async function main() {
  // A) Create the Fordefi provider
  const fordefiProvider = new FordefiWeb3Provider(config);

  // B) Wrap the fordefiProvider with Ethers.js
  const provider = new ethers.BrowserProvider(fordefiProvider);
  const signer = await provider.getSigner();

  // C) Load the Foundry artifact from `out/Counter.sol/Counter.json`
  const lockArtifactPath = path.join(__dirname, "..", "out", "Counter.sol", "Counter.json");
  const lockArtifact = JSON.parse(fs.readFileSync(lockArtifactPath, "utf8"));

  // D) Get Foundry bytecode from `artifact.bytecode.object`,
  const abi = lockArtifact.abi;
  let bytecode = lockArtifact.bytecode;
  if (bytecode && bytecode.object) {
    bytecode = bytecode.object;
  }

  // E) Deploy with Ethers
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log("Deploying contract...");
  const lock = await factory.deploy();

  console.log("Contract deployed to:", await lock.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error deploying contract:", err);
    process.exit(1);
  });

// Deploy command -> npx ts-node script/deploy.ts