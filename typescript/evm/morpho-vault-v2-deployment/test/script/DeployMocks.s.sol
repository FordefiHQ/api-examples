// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {ERC20Mock as AssetMock} from "openzeppelin-contracts/contracts/mocks/token/ERC20Mock.sol";
import {ERC4626Mock as VaultV1Mock} from "openzeppelin-contracts/contracts/mocks/token/ERC4626Mock.sol";
import {AdapterRegistryMock} from "../mocks/AdapterRegistryMock.sol";

contract DeployMocks is Script {
    function run() external returns (address, address, address) {
        vm.startBroadcast();

        address asset = address(new AssetMock());
        console.log("Mock Asset: ", asset);

        address vaultV1 = address(new VaultV1Mock(asset));
        console.log("Mock VaultV1", vaultV1);

        address registry = address(new AdapterRegistryMock());
        console.log("Mock Registry", registry);

        vm.stopBroadcast();

        return (asset, vaultV1, registry);
    }
}
