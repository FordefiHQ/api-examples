// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {VaultV2Factory} from "vault-v2/VaultV2Factory.sol";
import {MorphoVaultV1AdapterFactory} from "vault-v2/adapters/MorphoVaultV1AdapterFactory.sol";
import {MorphoMarketV1AdapterV2Factory} from "vault-v2/adapters/MorphoMarketV1AdapterV2Factory.sol";

contract DeployFactories is Script {
    function run() external returns (address, address, address) {
        // Use fallback mock addresses for test environments
        address morpho = vm.envOr("MORPHO", makeAddr("morpho"));
        address adaptiveCurveIrm = vm.envOr("ADAPTIVE_CURVE_IRM", makeAddr("adaptiveCurveIrm"));

        vm.startBroadcast();

        address vaultV2Factory = address(new VaultV2Factory());
        console.log("VaultV2Factory", vaultV2Factory);
        address morphoVaultV1AdapterFactory = address(new MorphoVaultV1AdapterFactory());
        console.log("MorphoVaultV1AdapterFactory", morphoVaultV1AdapterFactory);
        address morphoMarketV1AdapterV2Factory = address(new MorphoMarketV1AdapterV2Factory(morpho, adaptiveCurveIrm));
        console.log("MorphoMarketV1AdapterV2Factory", morphoMarketV1AdapterV2Factory);

        vm.stopBroadcast();

        return (vaultV2Factory, morphoVaultV1AdapterFactory, morphoMarketV1AdapterV2Factory);
    }
}
