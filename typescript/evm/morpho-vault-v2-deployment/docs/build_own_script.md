# Build your own deployment script

This tutorial walks through each step of the `DeployVaultV2.s.sol` script using Foundry, explaining what happens and showing the relevant code snippet. This is designed to help you build your own custom deployment script, where each snippet can serve as a building block.

Notes:

- Foundry requests the script to be wrapped with the cheatcodes `startBroadcast()` & `stopBroadcast()` to actually broadcast the transactions to the chain. The use of these cheatcodes is omitted in this tutorial. Refer to the `DeployVaultV2.s.sol` script for details;
- Refer to the [Vault V2 deployment readme](https://github.com/morpho-org/vault-v2-deployment) to have an example of the command to execute the script.

---

## Step 1: Set Up Wallet Addresses

**Description:**
Retrieve the addresses for the owner, curator, allocator, and (optionally) sentinel. One of the easiest ways to manage these addresses is using environment variables.

```solidity
address owner = vm.envAddress("OWNER");
address curator = vm.envAddress("CURATOR");
address allocator = vm.envAddress("ALLOCATOR");
address sentinel = vm.envExists("SENTINEL") ? vm.envAddress("SENTINEL") : address(0);
```

---

## Step 2: Set Timelock Duration

**Description:**
Optionally define a timelock duration for certain vault actions. Again, a straightforwrd approach is to use an environment variable.

```solidity
uint256 timelockDuration = vm.envExists("TIMELOCK_DURATION") ? vm.envUint("TIMELOCK_DURATION") : 0;
```

---

## Step 3: Get Vault V1 Address

**Description:**
In the deployment script, we assume the VaultV2 will be using a VaultV1 (which implements the ERC4626 specifications) as a Liquidity Market. Therefore, the script needs to get the VaultV1 address. Again, an environment variable can be used for that purpose to define the address of the VaultV1.

```solidity
import {IERC4626 as IVaultV1} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
IVaultV1 vaultV1 = IVaultV1(vm.envAddress("VAULT_V1"));
```


## Step 4: Deploy VaultV2

**Description:**
Deploy the VaultV2 contract directly, with

- first argument: the Broadcaster as the temporary owner. This role is needed to grant the other roles;
- second argument: the underlying asset of the VaultV1, aka the Loan Asset.

```solidity
import {VaultV2} from "vault-v2/VaultV2.sol";
VaultV2 vaultV2 = new VaultV2(broadcaster, vaultV1.asset());
```

---

## Step 5: Grant Curator Role to Broadcaster

**Description:**
Temporarily assign the Curator role to the Broadcaster for initial setup.

```solidity
vaultV2.setCurator(broadcaster);
```

---

## Step 6: Deploy MorphoVaultV1 Adapter

**Description:**
Deploy the adapter that allows VaultV2 to interact with VaultV1.

```solidity
import {MorphoVaultV1Adapter} from "vault-v2/adapters/MorphoVaultV1Adapter.sol";
address morphoVaultV1Adapter = address(new MorphoVaultV1Adapter(address(vaultV2), address(vaultV1)));
```

---

## Step 7: Submit Timelocked Actions

**Description:**
Submit all actions that require a timelock (such as setting roles and caps) to the vault. These actions are queued for execution.
We also submit the action to eventually remove the Allocator role from the deployer.

```solidity
bytes memory idData = abi.encode("this", morphoVaultV1Adapter);
vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (deployer, true)));
// Submit Allocator removal from the deployer
vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (deployer, false)));
vaultV2.submit(abi.encodeCall(vaultV2.setIsAllocator, (allocator, true)));
vaultV2.submit(abi.encodeCall(vaultV2.setIsAdapter, (morphoVaultV1Adapter, true)));
vaultV2.submit(abi.encodeCall(vaultV2.increaseAbsoluteCap, (idData, type(uint128).max)));
vaultV2.submit(abi.encodeCall(vaultV2.increaseRelativeCap, (idData, 1e18)));
```

---

## Step 8: Execute Timelocked Actions

**Description:**
Immediately execute the actions that were just submitted (since timelocks are zero by default).

```solidity
vaultV2.setIsAllocator(broadcaster, true);
vaultV2.setIsAllocator(allocator, true);
vaultV2.setIsAdapter(morphoVaultV1Adapter, true);
vaultV2.increaseAbsoluteCap(idData, type(uint128).max);
vaultV2.increaseRelativeCap(idData, 1e18);
```

---

## Step 9: Set the Liquidity Market

**Description:**
Set the liquidity market for the vault using the adapter.

```solidity
vaultV2.setLiquidityAdapterAndData(morphoVaultV1Adapter, bytes(""));
```

---

## Step 10: Remove Allocator Role from Broadcaster

**Description:**
Remove the allocator role from the Broadcaster before setting timelocks.

```solidity
vaultV2.setIsAllocator(broadcaster, false);
```

---

## Step 11: Set Timelocks (Optional)

**Description:**
If a timelock duration is specified, set the timelock for various vault functions.

```solidity
if (timelockDuration > 0) {
    vaultV2.increaseTimelock(IVaultV2.setIsAllocator.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setSharesGate.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setReceiveAssetsGate.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setSendAssetsGate.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setIsAdapter.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.abdicateSubmit.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setPerformanceFee.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setManagementFee.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setPerformanceFeeRecipient.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setManagementFeeRecipient.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.increaseAbsoluteCap.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.increaseRelativeCap.selector, timelockDuration);
    vaultV2.increaseTimelock(IVaultV2.setForceDeallocatePenalty.selector, timelockDuration);
}
```

---

## Step 12: Set Final Roles

**Description:**
Assign the final roles for the vault: Curator, Sentinel (if provided), and Owner.

```solidity
vaultV2.setCurator(curator);
if (sentinel != address(0)) {
    vaultV2.setIsSentinel(sentinel, true);
}
vaultV2.setOwner(owner);
```
