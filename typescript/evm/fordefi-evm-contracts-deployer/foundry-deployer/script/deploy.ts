import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { getProvider } from "./get-provider"
import { FordefiProviderConfig } from "@fordefi/web3-provider";


// 1. Configure your Fordefi secrets (API User access token and API User private key)
dotenv.config();
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const privateKeyFilePath = "./fordefi_secret/private.pem";
const PEM_PRIVATE_KEY = fs.readFileSync(privateKeyFilePath, "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();


// 2. Chain ID configuration
//    Example: deploying on Base
const chainId = 8453;


// 3. Construct FordefiWeb3Provider config
const config: FordefiProviderConfig = {
  chainId,
  address: "0x8BFCF9e2764BC84DE4BBd0a0f5AAF19F47027A73", // Your Fordefi EVM Vault address
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: "https://base.llamarpc.com"
};

async function main() {
  // A) Create the Fordefi provider
  let provider = await getProvider(config);
  if (!provider) throw new Error("Failed to initialize provider");
  let web3Provider = new ethers.BrowserProvider(provider); 

  // B) Wrap the fordefiProvider with Ethers.js
  const signer = await web3Provider.getSigner();

  // C) Load the Foundry artifact
  const lockArtifactPath = path.join(__dirname, "..", "out", "Batcher.sol", "BatchTransfer.json");
  const lockArtifact = JSON.parse(fs.readFileSync(lockArtifactPath, "utf8"));

  // D) Get Foundry bytecode from `artifact.bytecode.object`,
  const abi = lockArtifact.abi;
  let bytecode = lockArtifact.bytecode;
  if (bytecode && bytecode.object) {
    bytecode = bytecode.object;
  }

  // E) Deploy!
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