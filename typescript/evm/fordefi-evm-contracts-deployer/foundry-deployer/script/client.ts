import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { getProvider } from "./get-provider";
import { FordefiProviderConfig } from "@fordefi/web3-provider";
import { batchConfig } from "./client-config";

dotenv.config();

const FORDEFI_API_USER_TOKEN = process.env.FORDEFI_API_USER_TOKEN ??
  (() => { throw new Error("FORDEFI_API_USER_TOKEN is not set"); })();
const PEM_PRIVATE_KEY = fs.readFileSync("./fordefi_secret/private.pem", "utf8") ??
  (() => { throw new Error("PEM_PRIVATE_KEY is not set"); })();
const FORDEFI_EVM_VAULT_ADDRESS = process.env.FORDEFI_EVM_VAULT_ADDRESS ??
  (() => { throw new Error("FORDEFI_EVM_VAULT_ADDRESS is not set"); })();
const RPC_URL = process.env.RPC_URL ??
  (() => { throw new Error("RPC_URL is not set"); })();
const CHAIN_ID = Number(process.env.CHAIN_ID ?? (() => { throw new Error("CHAIN_ID is not set"); })());
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ??
  (() => { throw new Error("CONTRACT_ADDRESS is not set"); })();

const config: FordefiProviderConfig = {
  chainId: CHAIN_ID,
  address: FORDEFI_EVM_VAULT_ADDRESS as `0x${string}`,
  apiUserToken: FORDEFI_API_USER_TOKEN,
  apiPayloadSignKey: PEM_PRIVATE_KEY,
  rpcUrl: RPC_URL,
};

async function main() {
  const provider = await getProvider(config);
  if (!provider) throw new Error("Failed to initialize provider");
  const web3Provider = new ethers.BrowserProvider(provider);
  const signer = await web3Provider.getSigner();

  // Load ABI from Foundry artifact
  const artifactPath = path.join(__dirname, "..", "out", "Batcher.sol", "BatchTransfer.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, signer);

  const { mode, recipients, amountPerRecipient, amounts, tokenAddress } = batchConfig;

  console.log(`Mode: ${mode}`);
  console.log(`Recipients: ${recipients.length}`);

  let tx: ethers.TransactionResponse;

  switch (mode) {
    case "batchSendETHSameAmount": {
      if (!amountPerRecipient) throw new Error("amountPerRecipient is required");
      const total = BigInt(amountPerRecipient) * BigInt(recipients.length);
      console.log(`Amount per recipient: ${ethers.formatEther(amountPerRecipient)} ETH`);
      console.log(`Total ETH: ${ethers.formatEther(total)}`);
      const batchSendETHSame = contract.getFunction("batchSendETHSameAmount");
      tx = await batchSendETHSame(recipients, amountPerRecipient, { value: total });
      break;
    }

    case "batchSendETHDifferentAmounts": {
      if (!amounts || amounts.length !== recipients.length) throw new Error("amounts array must match recipients length");
      const total = amounts.reduce((sum, a) => sum + BigInt(a), 0n);
      console.log(`Total ETH: ${ethers.formatEther(total)}`);
      const batchSendETHDiff = contract.getFunction("batchSendETHDifferentAmounts");
      tx = await batchSendETHDiff(recipients, amounts, { value: total });
      break;
    }

    case "batchSendTokenSameAmount": {
      if (!tokenAddress) throw new Error("tokenAddress is required for token modes");
      if (!amountPerRecipient) throw new Error("amountPerRecipient is required");
      const total = BigInt(amountPerRecipient) * BigInt(recipients.length);
      console.log(`Token: ${tokenAddress}`);
      console.log(`Amount per recipient: ${amountPerRecipient}`);
      console.log(`Total tokens: ${total.toString()}`);

      // Check and set allowance if needed
      const token = new ethers.Contract(tokenAddress, [
        "function allowance(address,address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
      ], signer);
      const allowanceFn = token.getFunction("allowance");
      const currentAllowance: bigint = await allowanceFn(await signer.getAddress(), CONTRACT_ADDRESS);
      if (currentAllowance < total) {
        console.log(`Current allowance: ${currentAllowance}. Approving ${total}...`);
        const approveFn = token.getFunction("approve");
        const approveTx = await approveFn(CONTRACT_ADDRESS, total);
        console.log(`Approve tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("Approval confirmed.");
      }

      const batchSendTokenSame = contract.getFunction("batchSendTokenSameAmount");
      tx = await batchSendTokenSame(tokenAddress, recipients, amountPerRecipient);
      break;
    }

    case "batchSendTokenDifferentAmounts": {
      if (!tokenAddress) throw new Error("tokenAddress is required for token modes");
      if (!amounts || amounts.length !== recipients.length) throw new Error("amounts array must match recipients length");
      const total = amounts.reduce((sum, a) => sum + BigInt(a), 0n);
      console.log(`Token: ${tokenAddress}`);
      console.log(`Total tokens: ${total.toString()}`);

      const token = new ethers.Contract(tokenAddress, [
        "function allowance(address,address) view returns (uint256)",
        "function approve(address,uint256) returns (bool)",
      ], signer);
      const allowanceFn = token.getFunction("allowance");
      const currentAllowance: bigint = await allowanceFn(await signer.getAddress(), CONTRACT_ADDRESS);
      if (currentAllowance < total) {
        console.log(`Current allowance: ${currentAllowance}. Approving ${total}...`);
        const approveFn = token.getFunction("approve");
        const approveTx = await approveFn(CONTRACT_ADDRESS, total);
        console.log(`Approve tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log("Approval confirmed.");
      }

      const batchSendTokenDiff = contract.getFunction("batchSendTokenDifferentAmounts");
      tx = await batchSendTokenDiff(tokenAddress, recipients, amounts);
      break;
    }
  }

  console.log(`Transaction sent: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
