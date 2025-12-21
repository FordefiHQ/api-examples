// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {CommonBase} from "forge-std/Base.sol";

import {DeployMocks} from "./script/DeployMocks.s.sol";
import {DeployFactories} from "./script/DeployFactories.s.sol";
import {DeployVaultV2} from "script/DeployVaultV2.s.sol";

import {IVaultV2} from "vault-v2/interfaces/IVaultV2.sol";

import {IERC4626 as IVaultV1} from "openzeppelin-contracts/contracts/interfaces/IERC4626.sol";
import {ERC20Mock as AssetMock} from "openzeppelin-contracts/contracts/mocks/token/ERC20Mock.sol";

contract newAdapter {
    function realAssets() external pure returns (uint256 assets) {
        return 100 ether;
    }
}

contract DeployTest is Test {
    address owner;
    address curator;
    address allocator;
    address sentinel;
    address asset;
    address registry;
    address vaultV2Factory;
    address morphoVaultV1AdapterFactory;
    IVaultV1 vaultV1;
    IVaultV2 vaultV2;
    uint256 timelockDuration;

    function setUp() public {
        vm.chainId(0);
        address vaultV1Addr;
        (asset, vaultV1Addr, registry) = new DeployMocks().run();
        vaultV1 = IVaultV1(vaultV1Addr);
        assertEq(address(vaultV1.asset()), asset);
        (vaultV2Factory, morphoVaultV1AdapterFactory,) = new DeployFactories().run();
        owner = makeAddr("owner");
        curator = makeAddr("curator");
        allocator = makeAddr("allocator");
        sentinel = makeAddr("sentinel");
        timelockDuration = 500;
        vaultV2 = IVaultV2(
            new DeployVaultV2()
                .runWithArguments(
                    owner,
                    curator,
                    allocator,
                    sentinel,
                    timelockDuration,
                    vaultV1,
                    registry,
                    vaultV2Factory,
                    morphoVaultV1AdapterFactory,
                    0
                )
        );
    }

    function test_newVaultV2() public {
        new DeployVaultV2()
            .runWithArguments(
                owner,
                curator,
                allocator,
                sentinel,
                timelockDuration,
                vaultV1,
                registry,
                vaultV2Factory,
                morphoVaultV1AdapterFactory,
                0
            );
        assertEq(vaultV2.owner(), owner);
    }

    function test_DeployWithSameAddress() public {
        address broadcaster = 0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38;
        vaultV2 = IVaultV2(
            new DeployVaultV2()
                .runWithArguments(
                    broadcaster,
                    broadcaster,
                    broadcaster,
                    broadcaster,
                    timelockDuration,
                    vaultV1,
                    registry,
                    vaultV2Factory,
                    morphoVaultV1AdapterFactory,
                    0
                )
        );
    }

    function test_FullDeployment() public view {
        assertEq(vaultV2.owner(), owner, "Owner should be set correctly");
        assertEq(vaultV2.curator(), curator, "Curator should be set correctly");
        assertTrue(vaultV2.isAllocator(allocator), "Allocator should be set correctly");
        assertTrue(vaultV2.isSentinel(sentinel), "Sentinel should be set correctly");
    }

    function test_DepositAndWithdraw() public {
        address user = makeAddr("user");
        AssetMock assetToken = AssetMock(vaultV1.asset());
        uint256 depositAmount = 100 ether;

        assetToken.mint(user, depositAmount);
        assertEq(assetToken.balanceOf(user), depositAmount);

        vm.startPrank(user);
        assetToken.approve(address(vaultV2), depositAmount);
        vaultV2.deposit(depositAmount, user);
        assertEq(assetToken.balanceOf(user), 0);
        vm.stopPrank();

        // Sending assets to vaultV1 to simulate the yield
        uint256 giftToVaultV1 = 1 ether;
        assetToken.mint(address(vaultV1), giftToVaultV1);

        vm.startPrank(user);
        uint256 shares = vaultV2.balanceOf(user);
        vaultV2.redeem(shares, user, user);
        vm.stopPrank();

        assertApproxEqRel(assetToken.balanceOf(user), depositAmount + giftToVaultV1, 5e16); // 5% tolerance
        assertApproxEqRel(assetToken.balanceOf(address(vaultV1)) + 1e18, 1e18, 5e18); // 500% tolerance
    }

    function test_TimelockedFunctions() public {
        // Setup
        bytes memory idData = abi.encode("adapter", address(0x1234));
        address dummyAddr = address(0x5678);
        uint256 newFee = 1e9;
        uint256 newPenalty = 1e15;
        uint256 newCap = 1e18;

        // All selectors to test
        address testAdapter = address(new newAdapter());
        bytes[] memory calls = new bytes[](14);
        calls[0] = abi.encodeCall(vaultV2.setIsAllocator, (dummyAddr, true));
        calls[1] = abi.encodeCall(vaultV2.setReceiveSharesGate, (dummyAddr));
        calls[2] = abi.encodeCall(vaultV2.setReceiveAssetsGate, (dummyAddr));
        calls[3] = abi.encodeCall(vaultV2.setSendAssetsGate, (dummyAddr));
        calls[4] = abi.encodeCall(vaultV2.addAdapter, (testAdapter));
        calls[5] = abi.encodeCall(vaultV2.removeAdapter, (testAdapter));
        calls[6] = abi.encodeCall(vaultV2.setPerformanceFeeRecipient, (dummyAddr));
        calls[7] = abi.encodeCall(vaultV2.setManagementFeeRecipient, (dummyAddr));
        calls[8] = abi.encodeCall(vaultV2.setPerformanceFee, (newFee));
        calls[9] = abi.encodeCall(vaultV2.setManagementFee, (newFee));
        calls[10] = abi.encodeCall(vaultV2.increaseAbsoluteCap, (idData, newCap));
        calls[11] = abi.encodeCall(vaultV2.increaseRelativeCap, (idData, newCap));
        calls[12] = abi.encodeCall(vaultV2.setForceDeallocatePenalty, (dummyAddr, newPenalty));
        calls[13] = abi.encodeCall(vaultV2.setIsAllocator, (dummyAddr, false));

        bool success;
        vm.startPrank(curator);
        for (uint256 i = 0; i < calls.length; i++) {
            uint256 currentTime = block.timestamp;
            vaultV2.submit(calls[i]);

            uint256 executableAt = vaultV2.executableAt(calls[i]);

            if (executableAt > currentTime) {
                // Has a non-zero timelock duration

                // Call before timelock expires - should fail
                (success,) = address(vaultV2).call(calls[i]);
                assertFalse(
                    success, string.concat("call should have failed before timelock expired at index ", vm.toString(i))
                );

                // Warp to when the function becomes executable
                vm.warp(executableAt);
            }

            // Call when the function is executable - should succeed
            (bool ok,) = address(vaultV2).call(calls[i]);
            assertTrue(ok, string.concat("call failed at index ", vm.toString(i)));

            // Advance time slightly to ensure next submission has different timestamp
            vm.warp(block.timestamp + 1);
        }
        vm.stopPrank();
    }

    function test_DeadDeposit() public {
        uint256 deadDepositAmount = 10 ether;

        AssetMock(vaultV1.asset()).mint(CommonBase.DEFAULT_SENDER, deadDepositAmount);

        console.log("Test dead deposit amount:", deadDepositAmount);

        // Deploy a new vault with dead deposit
        IVaultV2 vaultWithDeadDeposit = IVaultV2(
            new DeployVaultV2()
                .runWithArguments(
                    owner,
                    curator,
                    allocator,
                    sentinel,
                    timelockDuration,
                    vaultV1,
                    registry,
                    vaultV2Factory,
                    morphoVaultV1AdapterFactory,
                    deadDepositAmount
                )
        );

        // Check that the dead deposit was made (vault should have shares)
        uint256 totalSupply = vaultWithDeadDeposit.totalSupply();
        assertGt(totalSupply, 0, "Dead deposit should create shares");

        // Check that the vault has the expected amount of assets
        uint256 vaultAssets = vaultWithDeadDeposit.totalAssets();
        assertApproxEqRel(
            vaultAssets, deadDepositAmount, 1e15, "Vault should have approximately the dead deposit amount"
        );

        // Verify that the dead deposit shares belong to address(0) (burned shares)
        // Since shares are burned, they shouldn't be transferable and totalSupply should reflect this
        assertEq(
            vaultWithDeadDeposit.balanceOf(address(0)),
            0,
            "Dead deposit shares should be burned (address(0) has no balance)"
        );
    }
}
