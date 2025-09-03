import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { getProvider } from "./get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";


// Configure your Fordefi secrets (API User access token and API User private key) and RPC endpoint
dotenv.config();
const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ?? 
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const PEM_PRIVATE_KEY = fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
  (() => { throw new Error("FORDEFI_EVM_VAULT_ADDRESS is not set"); })();
const RPC_URL = process.env.RPC_URL ??
  (() => { throw new Error("RPC_URL is not set"); })();

// Construct FordefiWeb3Provider config
const config: FordefiProviderConfig = {
  chainId: 1,
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: RPC_URL
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

  // E) Estimate gas cost
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log("Estimating deployment cost...");

  // Get current gas price
  const gasPrice = await web3Provider.getFeeData();
  console.log("Current gas price: ", ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"), "gwei");

  // Estimate deployment gas
  const deployTx = await factory.getDeployTransaction();
  const estimatedGas = await web3Provider.estimateGas(deployTx);
  console.log("Estimated gas for deployment: ", estimatedGas.toString());

  // Estimate deployment cost in ETH
  const estimatedEthCost = estimatedGas * (gasPrice.gasPrice || 0n);
  console.log("Estimated deployment cost", ethers.formatEther(estimatedEthCost), "ETH");

  // F) Deploy!
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