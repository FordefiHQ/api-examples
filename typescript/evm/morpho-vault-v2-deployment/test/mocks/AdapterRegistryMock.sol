// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (c) 2025 Morpho Association
pragma solidity 0.8.28;

import {IAdapterRegistry} from "vault-v2/interfaces/IAdapterRegistry.sol";

contract AdapterRegistryMock is IAdapterRegistry {
    mapping(address => bool) private _registry;

    function isInRegistry(address) external pure override returns (bool) {
        return true;
    }
}
