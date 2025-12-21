/**
 * Morpho VaultV2 Deployment Script (USDC on Base)
 *
 * This script deploys a Morpho VaultV2 using Fordefi.
 * By default, it is configured for USDC vaults on Base network.
 *
 * Morpho vaults are single-token contracts - each vault holds exactly one underlying asset.
 * The underlying asset is determined by the VaultV1 specified in VAULT_V1 env variable.
 *
 * To deploy with a different underlying asset:
 * 1. Set VAULT_V1 to a VaultV1 address with your desired underlying token
 * 2. Adjust DEAD_DEPOSIT_AMOUNT for the token's decimals (default is 1 USDC = 1000000)
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { getProvider } from "./get-provider";
import { ethers, keccak256, toUtf8Bytes, AbiCoder, MaxUint256, Contract } from "ethers";
import { 
  config, 
  OWNER, 
  CURATOR, 
  ALLOCATOR, 
  SENTINEL, 
  VAULT_V1, 
  ADAPTER_REGISTRY, 
  VAULT_V2_FACTORY, 
  MORPHO_VAULT_V1_ADAPTER_FACTORY, 
  TIMELOCK_DURATION, 
  DEAD_DEPOSIT_AMOUNT} from "./config";

dotenv.config();

// Function selectors for IVaultV2 timelocked functions
const TIMELOCKED_SELECTORS = {
  setReceiveSharesGate: "0x9faae464",
  setSendSharesGate: "0x5b34b823",
  setReceiveAssetsGate: "0x60d54d41",
  addAdapter: "0x60a38ac1",
  increaseAbsoluteCap: "0x0b467b9b",
  increaseRelativeCap: "0xed27f7c9",
  setForceDeallocatePenalty: "0x4b219d16",
  abdicate: "0x5c9ce04d",
  removeAdapter: "0x98c9b49c",
  increaseTimelock: "0x47966291",
  setAdapterRegistry: "0xc21ad028"
};

async function callContract(contract: Contract, method: string, ...args: unknown[]) {
  const fn = contract.getFunction(method);
  return fn(...args);
}

async function loadAbi(contractPath: string): Promise<ethers.InterfaceAbi> {
  const artifactPath = path.join(__dirname, "..", "out", contractPath);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return artifact.abi;
}

async function main() {
  console.log("\n=== Begin VaultV2 Deployment with Fordefi ===\n");

  // A) Load ABIs
  const vaultV2FactoryAbi = await loadAbi("VaultV2Factory.sol/VaultV2Factory.json");
  const morphoAdapterFactoryAbi = await loadAbi("MorphoVaultV1AdapterFactory.sol/MorphoVaultV1AdapterFactory.json");
  const vaultV2Abi = await loadAbi("VaultV2.sol/VaultV2.json");
  const erc4626Abi = await loadAbi("ERC4626.sol/ERC4626.json");
  const erc20Abi = await loadAbi("ERC20.sol/ERC20.json");

  // B) Create the Fordefi provider
  const provider = await getProvider(config);
  if (!provider) throw new Error("Failed to initialize provider");
  const web3Provider = new ethers.BrowserProvider(provider);
  const signer = await web3Provider.getSigner();
  const signerAddress = await signer.getAddress();

  // C) Create contract instances
  const vaultV2Factory = new ethers.Contract(VAULT_V2_FACTORY, vaultV2FactoryAbi, signer);
  const morphoAdapterFactory = new ethers.Contract(MORPHO_VAULT_V1_ADAPTER_FACTORY, morphoAdapterFactoryAbi, signer);
  const vaultV1 = new ethers.Contract(VAULT_V1, erc4626Abi, signer);

  // D) Get underlying asset from VaultV1
  const underlyingAsset = await callContract(vaultV1, "asset");
  const underlyingTokenInfo = new ethers.Contract(underlyingAsset, erc20Abi, signer);
  const underlyingSymbol = await callContract(underlyingTokenInfo, "symbol");
  const underlyingName = await callContract(vaultV1, "name");

  console.log("Deployer address:", signerAddress);
  console.log("\nConfiguration:");
  console.log("  Owner:", OWNER);
  console.log("  Curator:", CURATOR);
  console.log("  Allocator:", ALLOCATOR);
  console.log("  Sentinel:", SENTINEL === ethers.ZeroAddress ? "None" : SENTINEL);
  console.log("  Yield Source (Morpho VaultV1):", VAULT_V1, `(${underlyingName})`);
  console.log("  Underlying Asset:", underlyingAsset, `(${underlyingSymbol})`);
  console.log("  Timelock Duration:", TIMELOCK_DURATION, "seconds");

  // E) Generate unique salt for deterministic deployment
  const block = await web3Provider.getBlock("latest");
  const salt = keccak256(toUtf8Bytes(`${block!.timestamp}-${signerAddress}-${Date.now()}`));
  console.log("\n  Salt:", salt);

  //// DEPLOYMENT ////

  // Phase 1: Deploy VaultV2 instance
  console.log("\n=== Phase 1: Deploying VaultV2 Instance ===");
  const deployTx = await callContract(vaultV2Factory, "createVaultV2", signerAddress, underlyingAsset, salt);
  console.log("  Transaction hash:", deployTx.hash);
  const deployReceipt = await deployTx.wait();

  // Get deployed VaultV2 address from event
  const createEventTopic = vaultV2Factory.interface.getEvent("CreateVaultV2")!.topicHash;
  const createEvent = deployReceipt.logs.find(
    (log: { topics: string[] }) => log.topics[0] === createEventTopic
  );
  if (!createEvent) throw new Error("CreateVaultV2 event not found");
  const vaultV2Address = "0x" + createEvent.topics[3].slice(26);
  console.log("  VaultV2 deployed at:", vaultV2Address);

  const vaultV2 = new ethers.Contract(vaultV2Address, vaultV2Abi, signer);

  // Phase 2: Configure temporary permissions
  console.log("\n=== Phase 2: Configuring Temporary Permissions ===");
  const setCuratorTx = await callContract(vaultV2, "setCurator", signerAddress);
  await setCuratorTx.wait();
  console.log("  Temporary curator set to:", signerAddress);

  // Phase 3: Deploy and configure Morpho adapter
  console.log("\n=== Phase 3: Deploying MorphoVaultV1 Adapter ===");
  const adapterTx = await callContract(morphoAdapterFactory, "createMorphoVaultV1Adapter", vaultV2Address, VAULT_V1);
  console.log("  Transaction hash:", adapterTx.hash);
  const adapterReceipt = await adapterTx.wait();

  // Get deployed adapter address from event
  const adapterEventTopic = morphoAdapterFactory.interface.getEvent("CreateMorphoVaultV1Adapter")!.topicHash;
  const adapterEvent = adapterReceipt.logs.find(
    (log: { topics: string[] }) => log.topics[0] === adapterEventTopic
  );
  if (!adapterEvent) throw new Error("CreateMorphoVaultV1Adapter event not found");
  const morphoAdapterAddress = "0x" + adapterEvent.topics[3].slice(26);
  console.log("  MorphoVaultV1Adapter deployed at:", morphoAdapterAddress);

  // Phase 4: Submit timelocked configuration changes
  console.log("\n=== Phase 4: Submitting Timelocked Configuration Changes ===");
  const abiCoder = AbiCoder.defaultAbiCoder();
  const adapterIdData = abiCoder.encode(["string", "address"], ["this", morphoAdapterAddress]);

  const submitCalls = [
    vaultV2.interface.encodeFunctionData("setIsAllocator", [signerAddress, true]),
    vaultV2.interface.encodeFunctionData("setAdapterRegistry", [ADAPTER_REGISTRY]),
    vaultV2.interface.encodeFunctionData("setLiquidityAdapterAndData", [morphoAdapterAddress, "0x"]),
    vaultV2.interface.encodeFunctionData("addAdapter", [morphoAdapterAddress]),
    vaultV2.interface.encodeFunctionData("increaseAbsoluteCap", [adapterIdData, MaxUint256 >> 128n]),
    vaultV2.interface.encodeFunctionData("increaseRelativeCap", [adapterIdData, ethers.parseEther("1")])
  ];

  // Submit if allocator != temporary
  if (signerAddress.toLowerCase() !== ALLOCATOR.toLowerCase()) {
    submitCalls.push(
      vaultV2.interface.encodeFunctionData("setIsAllocator", [signerAddress, false]),
      vaultV2.interface.encodeFunctionData("setIsAllocator", [ALLOCATOR, true])
    );
  }

  for (const callData of submitCalls) {
    const tx = await callContract(vaultV2, "submit", callData);
    await tx.wait();
  }
  console.log("  Submitted", submitCalls.length, "timelocked configuration changes");

  // Phase 5: Execute immediate configuration changes
  console.log("\n=== Phase 5: Executing Immediate Configuration Changes ===");

  let tx = await callContract(vaultV2, "setAdapterRegistry", ADAPTER_REGISTRY);
  await tx.wait();
  console.log("  Set adapter registry");

  tx = await callContract(vaultV2, "setIsAllocator", signerAddress, true);
  await tx.wait();
  console.log("  \nSet temporary allocator");

  tx = await callContract(vaultV2, "addAdapter", morphoAdapterAddress);
  await tx.wait();
  console.log("  \nAdded adapter");

  tx = await callContract(vaultV2, "setLiquidityAdapterAndData", morphoAdapterAddress, "0x");
  await tx.wait();
  console.log("  \nSet liquidity adapter");

  tx = await callContract(vaultV2, "increaseAbsoluteCap", adapterIdData, MaxUint256 >> 128n);
  await tx.wait();
  console.log("  \nIncreased absolute cap");

  tx = await callContract(vaultV2, "increaseRelativeCap", adapterIdData, ethers.parseEther("1"));
  await tx.wait();
  console.log("  \nIncreased relative cap");

  // Finalize allocator role changes
  if (signerAddress.toLowerCase() !== ALLOCATOR.toLowerCase()) {
    tx = await callContract(vaultV2, "setIsAllocator", signerAddress, false);
    await tx.wait();
    tx = await callContract(vaultV2, "setIsAllocator", ALLOCATOR, true);
    await tx.wait();
    console.log("  Transferred allocator role to:", ALLOCATOR);
  }

  // Abdicate setAdapterRegistry function
  const abdicateCallData = vaultV2.interface.encodeFunctionData("abdicate", [TIMELOCKED_SELECTORS.setAdapterRegistry]);
  tx = await callContract(vaultV2, "submit", abdicateCallData);
  await tx.wait();
  tx = await callContract(vaultV2, "abdicate", TIMELOCKED_SELECTORS.setAdapterRegistry);
  await tx.wait();
  console.log("  Abdicated setAdapterRegistry function");

  // Phase 6: Configure timelock settings (if specified)
  if (TIMELOCK_DURATION > 0) {
    console.log("\n=== Phase 6: Configuring Timelock Settings ===");
    const selectorsToTimelock = [
      TIMELOCKED_SELECTORS.setReceiveSharesGate,
      TIMELOCKED_SELECTORS.setSendSharesGate,
      TIMELOCKED_SELECTORS.setReceiveAssetsGate,
      TIMELOCKED_SELECTORS.addAdapter,
      TIMELOCKED_SELECTORS.increaseAbsoluteCap,
      TIMELOCKED_SELECTORS.increaseRelativeCap,
      TIMELOCKED_SELECTORS.setForceDeallocatePenalty,
      TIMELOCKED_SELECTORS.abdicate,
      TIMELOCKED_SELECTORS.removeAdapter,
      TIMELOCKED_SELECTORS.increaseTimelock
    ];

    // Submit timelock increases
    for (const selector of selectorsToTimelock) {
      const callData = vaultV2.interface.encodeFunctionData("increaseTimelock", [selector, TIMELOCK_DURATION]);
      const submitTx = await callContract(vaultV2, "submit", callData);
      await submitTx.wait();
    }
    console.log("  Submitted timelock increases for", selectorsToTimelock.length, "functions");

    // Execute timelock increases
    for (const selector of selectorsToTimelock) {
      const execTx = await callContract(vaultV2, "increaseTimelock", selector, TIMELOCK_DURATION);
      await execTx.wait();
    }
    console.log("  Executed timelock increases for", selectorsToTimelock.length, "functions");
  }

  // Phase 7: Set final role assignments
  console.log("\n=== Phase 7: Setting Final Role Assignments ===");

  tx = await callContract(vaultV2, "setCurator", CURATOR);
  await tx.wait();
  console.log("  Set curator:", CURATOR);

  if (SENTINEL !== ethers.ZeroAddress) {
    tx = await callContract(vaultV2, "setIsSentinel", SENTINEL, true);
    await tx.wait();
    console.log("  Set sentinel:", SENTINEL);
  }

  tx = await callContract(vaultV2, "setOwner", OWNER);
  await tx.wait();
  console.log("  Set owner:", OWNER);

  // Phase 8: Execute dead USDC deposit if specified
  if (DEAD_DEPOSIT_AMOUNT > 0n) {
    console.log(`\n=== Phase 8: Executing Dead Deposit (${underlyingSymbol}) ===`);
    const underlyingToken = new ethers.Contract(underlyingAsset, erc20Abi, signer);

    tx = await callContract(underlyingToken, "approve", vaultV2Address, DEAD_DEPOSIT_AMOUNT);
    await tx.wait();
    console.log("  Approved", DEAD_DEPOSIT_AMOUNT.toString(), "tokens");

    tx = await callContract(vaultV2, "deposit", DEAD_DEPOSIT_AMOUNT, "0x000000000000000000000000000000000000dEaD");
    await tx.wait();
    console.log("  Deposited to dead address");
  }

  console.log("\n=== Deployment Complete ===");
  console.log("VaultV2 Address:", vaultV2Address);
  console.log("MorphoVaultV1Adapter Address:", morphoAdapterAddress);
  console.log("\nFinal Configuration:");
  console.log("  Owner:", OWNER);
  console.log("  Curator:", CURATOR);
  console.log("  Allocator:", ALLOCATOR);
  if (SENTINEL !== ethers.ZeroAddress) {
    console.log("  Sentinel:", SENTINEL);
  }
  console.log("  Timelock Duration:", TIMELOCK_DURATION, "seconds");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error deploying VaultV2:", err);
    process.exit(1);
  });
