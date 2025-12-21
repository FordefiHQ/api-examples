// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {IVaultV2} from "vault-v2/interfaces/IVaultV2.sol";
import {VaultV2} from "vault-v2/VaultV2.sol";
import {VaultV2Factory} from "vault-v2/VaultV2Factory.sol";
import {MorphoVaultV1AdapterFactory} from "vault-v2/adapters/MorphoVaultV1AdapterFactory.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC4626 as IVaultV1} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";

/**
 * @title DeployVaultV2
 * @notice Deployment script for VaultV2 with comprehensive setup including:
 *         - VaultV2 instance creation
 *         - MorphoVaultV1 adapter deployment and configuration
 *         - Role management (owner, curator, allocator, sentinel)
 *         - Timelock configuration for critical functions
 *         - Dead deposit functionality for initial vault seeding
 * @dev This script handles the complete deployment and configuration of a VaultV2 instance
 *      with all necessary adapters, roles, and security measures in place.
 */
contract DeployVaultV2 is Script {
    /**
     * @notice Main deployment function that reads configuration from environment variables
     * @return vaultV2Address The address of the deployed VaultV2 instance
     */
    function run() external returns (address) {
        // Read configuration from environment variables
        DeploymentConfig memory config = _readEnvironmentConfig();

        return deployVaultV2WithConfig(config);
    }

    /**
     * @notice Deploy VaultV2 with explicit configuration parameters
     * @param vaultOwner Address that will own the vault after deployment
     * @param vaultCurator Address that can manage vault parameters
     * @param vaultAllocator Address that can allocate funds to adapters
     * @param vaultSentinel Address that can perform emergency actions (optional)
     * @param timelockDurationSeconds Duration in seconds for timelocked functions
     * @param sourceVaultV1 The VaultV1 instance to connect to
     * @param adapterRegistry Address of the adapter registry
     * @param vaultV2FactoryAddress Address of the VaultV2 factory
     * @param morphoAdapterFactoryAddress Address of the Morpho adapter factory
     * @param initialDeadDepositAmount Amount to deposit as dead deposit (0 to skip)
     * @return vaultV2Address The address of the deployed VaultV2 instance
     */
    function runWithArguments(
        address vaultOwner,
        address vaultCurator,
        address vaultAllocator,
        address vaultSentinel,
        uint256 timelockDurationSeconds,
        IVaultV1 sourceVaultV1,
        address adapterRegistry,
        address vaultV2FactoryAddress,
        address morphoAdapterFactoryAddress,
        uint256 initialDeadDepositAmount
    ) public returns (address) {
        DeploymentConfig memory config = DeploymentConfig({
            vaultOwner: vaultOwner,
            vaultCurator: vaultCurator,
            vaultAllocator: vaultAllocator,
            vaultSentinel: vaultSentinel,
            timelockDurationSeconds: timelockDurationSeconds,
            sourceVaultV1: sourceVaultV1,
            adapterRegistry: adapterRegistry,
            vaultV2FactoryAddress: vaultV2FactoryAddress,
            morphoAdapterFactoryAddress: morphoAdapterFactoryAddress,
            initialDeadDepositAmount: initialDeadDepositAmount
        });

        return deployVaultV2WithConfig(config);
    }

    /**
     * @notice Configuration struct for deployment parameters
     */
    struct DeploymentConfig {
        address vaultOwner;
        address vaultCurator;
        address vaultAllocator;
        address vaultSentinel;
        uint256 timelockDurationSeconds;
        IVaultV1 sourceVaultV1;
        address adapterRegistry;
        address vaultV2FactoryAddress;
        address morphoAdapterFactoryAddress;
        uint256 initialDeadDepositAmount;
    }

    /**
     * @notice Read configuration from environment variables
     * @return config Deployment configuration struct
     */
    function _readEnvironmentConfig() internal view returns (DeploymentConfig memory config) {
        config.vaultOwner = vm.envAddress("OWNER");
        config.vaultCurator = vm.envAddress("CURATOR");
        config.vaultAllocator = vm.envAddress("ALLOCATOR");
        config.vaultSentinel = vm.envExists("SENTINEL") ? vm.envAddress("SENTINEL") : address(0);
        config.timelockDurationSeconds = vm.envExists("TIMELOCK_DURATION") ? vm.envUint("TIMELOCK_DURATION") : 0;
        config.sourceVaultV1 = IVaultV1(vm.envAddress("VAULT_V1"));
        config.adapterRegistry = vm.envAddress("ADAPTER_REGISTRY");
        config.vaultV2FactoryAddress = vm.envAddress("VAULT_V2_FACTORY");
        config.morphoAdapterFactoryAddress = vm.envAddress("MORPHO_VAULT_V1_ADAPTER_FACTORY");
        config.initialDeadDepositAmount = vm.envExists("DEAD_DEPOSIT_AMOUNT") ? vm.envUint("DEAD_DEPOSIT_AMOUNT") : 0;
    }

    /**
     * @notice Main deployment logic with comprehensive vault setup
     * @param config Deployment configuration
     * @return deployedVaultV2Address Address of the deployed VaultV2
     */
    function deployVaultV2WithConfig(DeploymentConfig memory config) internal returns (address) {
        address transactionOriginator = tx.origin;

        vm.startBroadcast();

        // Phase 1: Deploy VaultV2 instance
        VaultV2 deployedVaultV2 =
            _deployVaultV2Instance(config.vaultV2FactoryAddress, transactionOriginator, config.sourceVaultV1.asset());

        // Phase 2: Configure temporary permissions
        _configureTemporaryPermissions(deployedVaultV2, transactionOriginator);

        // Phase 3: Deploy and configure Morpho adapter
        address morphoAdapterAddress = _deployAndConfigureMorphoAdapter(
            config.morphoAdapterFactoryAddress, address(deployedVaultV2), address(config.sourceVaultV1)
        );

        // Phase 4: Submit timelocked configuration changes
        _submitTimelockedConfigurationChanges(
            deployedVaultV2, transactionOriginator, config.vaultAllocator, config.adapterRegistry, morphoAdapterAddress
        );

        // Phase 5: Execute immediate configuration changes
        _executeImmediateConfigurationChanges(
            deployedVaultV2, transactionOriginator, config.vaultAllocator, config.adapterRegistry, morphoAdapterAddress
        );

        // Phase 6: Configure timelock settings
        if (config.timelockDurationSeconds > 0) {
            _configureTimelockSettings(deployedVaultV2, config.timelockDurationSeconds);
        }

        // Phase 7: Set final role assignments
        _setFinalRoleAssignments(deployedVaultV2, config.vaultOwner, config.vaultCurator, config.vaultSentinel);

        // Phase 8: Execute dead deposit if specified
        if (config.initialDeadDepositAmount > 0) {
            _executeDeadDeposit(deployedVaultV2, config.initialDeadDepositAmount);
        }

        vm.stopBroadcast();

        console.log("VaultV2 deployment completed successfully at:", address(deployedVaultV2));
        return address(deployedVaultV2);
    }

    /**
     * @notice Deploy the VaultV2 instance using the factory
     * @param factoryAddress Address of the VaultV2 factory
     * @param temporaryOwner Address that will temporarily own the vault
     * @param underlyingAsset Address of the underlying asset token
     * @return deployedVault The deployed VaultV2 instance
     */
    function _deployVaultV2Instance(address factoryAddress, address temporaryOwner, address underlyingAsset)
        internal
        returns (VaultV2 deployedVault)
    {
        // Generate unique salt for deterministic deployment
        bytes32 uniqueSalt = keccak256(abi.encodePacked(block.timestamp + gasleft()));

        deployedVault =
            VaultV2(VaultV2Factory(factoryAddress).createVaultV2(temporaryOwner, underlyingAsset, uniqueSalt));

        console.log("VaultV2 deployed at:", address(deployedVault));
    }

    /**
     * @notice Configure temporary permissions for deployment process
     * @param vault The VaultV2 instance to configure
     * @param temporaryCurator Address to grant temporary curator role
     */
    function _configureTemporaryPermissions(VaultV2 vault, address temporaryCurator) internal {
        vault.setCurator(temporaryCurator);
        console.log("Temporary curator role assigned to:", temporaryCurator);
    }

    /**
     * @notice Deploy and configure the MorphoVaultV1 adapter
     * @param factoryAddress Address of the Morpho adapter factory
     * @param vaultV2Address Address of the VaultV2 instance
     * @param vaultV1Address Address of the source VaultV1 instance
     * @return adapterAddress Address of the deployed adapter
     */
    function _deployAndConfigureMorphoAdapter(address factoryAddress, address vaultV2Address, address vaultV1Address)
        internal
        returns (address adapterAddress)
    {
        adapterAddress =
            MorphoVaultV1AdapterFactory(factoryAddress).createMorphoVaultV1Adapter(vaultV2Address, vaultV1Address);

        console.log("MorphoVaultV1Adapter deployed at:", adapterAddress);
    }

    /**
     * @notice Submit timelocked configuration changes
     * @param vault The VaultV2 instance
     * @param temporaryAllocator Address with temporary allocator role
     * @param finalAllocator Address that will be the final allocator
     * @param registry Address of the adapter registry
     * @param adapter Address of the Morpho adapter
     */
    function _submitTimelockedConfigurationChanges(
        VaultV2 vault,
        address temporaryAllocator,
        address finalAllocator,
        address registry,
        address adapter
    ) internal {
        // Submit allocator role changes
        vault.submit(abi.encodeCall(vault.setIsAllocator, (temporaryAllocator, true)));
        if (temporaryAllocator != finalAllocator) {
            vault.submit(abi.encodeCall(vault.setIsAllocator, (temporaryAllocator, false)));
            vault.submit(abi.encodeCall(vault.setIsAllocator, (finalAllocator, true)));
        }

        // Submit adapter registry configuration
        vault.submit(abi.encodeCall(vault.setAdapterRegistry, (registry)));

        // Submit liquidity adapter configuration
        vault.submit(abi.encodeCall(vault.setLiquidityAdapterAndData, (adapter, bytes(""))));

        // Submit adapter and cap configurations
        bytes memory adapterIdData = abi.encode("this", adapter);
        vault.submit(abi.encodeCall(vault.addAdapter, (adapter)));
        vault.submit(abi.encodeCall(vault.increaseAbsoluteCap, (adapterIdData, type(uint128).max)));
        vault.submit(abi.encodeCall(vault.increaseRelativeCap, (adapterIdData, 1e18)));

        console.log("All timelocked configuration changes submitted");
    }

    /**
     * @notice Execute immediate configuration changes
     * @param vault The VaultV2 instance
     * @param temporaryAllocator Address with temporary allocator role
     * @param finalAllocator Address that will be the final allocator
     * @param registry Address of the adapter registry
     * @param adapter Address of the Morpho adapter
     */
    function _executeImmediateConfigurationChanges(
        VaultV2 vault,
        address temporaryAllocator,
        address finalAllocator,
        address registry,
        address adapter
    ) internal {
        // Execute adapter registry configuration
        vault.setAdapterRegistry(registry);

        // Execute allocator role configuration
        vault.setIsAllocator(temporaryAllocator, true);

        // Execute adapter configuration
        vault.addAdapter(adapter);
        vault.setLiquidityAdapterAndData(adapter, bytes(""));

        // Execute cap configurations
        bytes memory adapterIdData = abi.encode("this", adapter);
        vault.increaseAbsoluteCap(adapterIdData, type(uint128).max);
        vault.increaseRelativeCap(adapterIdData, 1e18);

        // Finalize allocator role changes
        if (temporaryAllocator != finalAllocator) {
            vault.setIsAllocator(temporaryAllocator, false);
            vault.setIsAllocator(finalAllocator, true);
        }

        // Abdicate setAdapterRegistry function to prevent future changes
        vault.submit(abi.encodeCall(vault.abdicate, (IVaultV2.setAdapterRegistry.selector)));
        vault.abdicate(IVaultV2.setAdapterRegistry.selector);
    }

    /**
     * @notice Configure timelock settings for critical functions
     * @param vault The VaultV2 instance
     * @param timelockDurationSeconds Duration in seconds for timelocked functions
     */
    function _configureTimelockSettings(VaultV2 vault, uint256 timelockDurationSeconds) internal {
        // Define function selectors that should be timelocked
        bytes4[] memory timelockedSelectors = new bytes4[](10);
        timelockedSelectors[0] = IVaultV2.setReceiveSharesGate.selector;
        timelockedSelectors[1] = IVaultV2.setSendSharesGate.selector;
        timelockedSelectors[2] = IVaultV2.setReceiveAssetsGate.selector;
        timelockedSelectors[3] = IVaultV2.addAdapter.selector;
        timelockedSelectors[4] = IVaultV2.increaseAbsoluteCap.selector;
        timelockedSelectors[5] = IVaultV2.increaseRelativeCap.selector;
        timelockedSelectors[6] = IVaultV2.setForceDeallocatePenalty.selector;
        timelockedSelectors[7] = IVaultV2.abdicate.selector;
        timelockedSelectors[8] = IVaultV2.removeAdapter.selector;
        timelockedSelectors[9] = IVaultV2.increaseTimelock.selector;

        // Submit timelock increases for all selectors
        for (uint256 i = 0; i < timelockedSelectors.length; i++) {
            vault.submit(abi.encodeCall(vault.increaseTimelock, (timelockedSelectors[i], timelockDurationSeconds)));
        }
        console.log("Timelock increases submitted for", timelockedSelectors.length, "functions");

        // Execute timelock increases for all selectors
        for (uint256 i = 0; i < timelockedSelectors.length; i++) {
            vault.increaseTimelock(timelockedSelectors[i], timelockDurationSeconds);
        }
        console.log("Timelock increases executed for", timelockedSelectors.length, "functions");
    }

    /**
     * @notice Set final role assignments for the vault
     * @param vault The VaultV2 instance
     * @param vaultOwner Address that will own the vault
     * @param vaultCurator Address that can manage vault parameters
     * @param vaultSentinel Address that can perform emergency actions (optional)
     */
    function _setFinalRoleAssignments(VaultV2 vault, address vaultOwner, address vaultCurator, address vaultSentinel)
        internal
    {
        vault.setCurator(vaultCurator);

        if (vaultSentinel != address(0)) {
            vault.setIsSentinel(vaultSentinel, true);
        }

        vault.setOwner(vaultOwner);

        console.log("Final role assignments completed:");
        console.log("  Owner:", vaultOwner);
        console.log("  Curator:", vaultCurator);
        if (vaultSentinel != address(0)) {
            console.log("  Sentinel:", vaultSentinel);
        }
    }

    /**
     * @notice Execute dead deposit to seed the vault with initial liquidity
     * @param vault The VaultV2 instance
     * @param depositAmount Amount to deposit as dead deposit
     */
    function _executeDeadDeposit(VaultV2 vault, uint256 depositAmount) internal {
        IERC20(vault.asset()).approve(address(vault), depositAmount);
        vault.deposit(depositAmount, address(0xdead)); // Dead address for burned shares}
    }
}
