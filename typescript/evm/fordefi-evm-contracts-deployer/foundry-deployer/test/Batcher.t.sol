// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../src/Batcher.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MTK") {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BatchTransferTest is Test {
    BatchTransfer public batcher;
    MockERC20 public token;

    address public owner = address(1);
    address public user = address(2);
    address public recipient1 = address(3);
    address public recipient2 = address(4);
    address public recipient3 = address(5);

    function setUp() public {
        batcher = new BatchTransfer(owner);
        token = new MockERC20();

        vm.deal(user, 100 ether);
        token.mint(user, 10000 * 10**18);
    }

    /*//////////////////////////////////////////////////////////////
                            ETH BATCHING TESTS
    //////////////////////////////////////////////////////////////*/

    function testBatchSendETHSameAmount() public {
        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256 amountPerRecipient = 1 ether;
        uint256 totalAmount = amountPerRecipient * recipients.length;

        vm.prank(user);
        batcher.batchSendETHSameAmount{value: totalAmount}(recipients, amountPerRecipient);

        assertEq(recipient1.balance, 1 ether);
        assertEq(recipient2.balance, 1 ether);
        assertEq(recipient3.balance, 1 ether);
    }

    function testBatchSendETHDifferentAmounts() public {
        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1 ether;
        amounts[1] = 2 ether;
        amounts[2] = 3 ether;

        uint256 totalAmount = 6 ether;

        vm.prank(user);
        batcher.batchSendETHDifferentAmounts{value: totalAmount}(recipients, amounts);

        assertEq(recipient1.balance, 1 ether);
        assertEq(recipient2.balance, 2 ether);
        assertEq(recipient3.balance, 3 ether);
    }

    function testRevertETHNotEnoughFunding() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        vm.prank(user);
        vm.expectRevert(BatchTransfer.NotEnoughETH.selector);
        batcher.batchSendETHSameAmount{value: 1 ether}(recipients, 1 ether);
    }

    function testRevertETHZeroRecipients() public {
        address[] memory recipients = new address[](0);

        vm.prank(user);
        vm.expectRevert(BatchTransfer.RequireOneRecipient.selector);
        batcher.batchSendETHSameAmount{value: 0}(recipients, 1 ether);
    }

    function testRevertETHZeroAddress() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = address(0);

        vm.prank(user);
        vm.expectRevert(BatchTransfer.ZeroAddress.selector);
        batcher.batchSendETHSameAmount{value: 2 ether}(recipients, 1 ether);
    }

    function testRevertETHArrayLengthMismatch() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1 ether;
        amounts[1] = 1 ether;
        amounts[2] = 1 ether;

        vm.prank(user);
        vm.expectRevert(BatchTransfer.ArrayLengthMismatch.selector);
        batcher.batchSendETHDifferentAmounts{value: 3 ether}(recipients, amounts);
    }

    /*//////////////////////////////////////////////////////////////
                            TOKEN BATCHING TESTS
    //////////////////////////////////////////////////////////////*/

    function testBatchSendTokenSameAmount() public {
        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256 amountPerRecipient = 100 * 10**18;
        uint256 totalAmount = amountPerRecipient * recipients.length;

        vm.startPrank(user);
        token.approve(address(batcher), totalAmount);
        batcher.batchSendTokenSameAmount(address(token), recipients, amountPerRecipient);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient1), 100 * 10**18);
        assertEq(token.balanceOf(recipient2), 100 * 10**18);
        assertEq(token.balanceOf(recipient3), 100 * 10**18);
    }

    function testBatchSendTokenDifferentAmounts() public {
        address[] memory recipients = new address[](3);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        recipients[2] = recipient3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * 10**18;
        amounts[1] = 200 * 10**18;
        amounts[2] = 300 * 10**18;

        uint256 totalAmount = 600 * 10**18;

        vm.startPrank(user);
        token.approve(address(batcher), totalAmount);
        batcher.batchSendTokenDifferentAmounts(address(token), recipients, amounts);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient1), 100 * 10**18);
        assertEq(token.balanceOf(recipient2), 200 * 10**18);
        assertEq(token.balanceOf(recipient3), 300 * 10**18);
    }

    function testRevertTokenInsufficientAllowance() public {
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256 amountPerRecipient = 100 * 10**18;

        vm.startPrank(user);
        token.approve(address(batcher), 100 * 10**18);
        vm.expectRevert(BatchTransfer.InsufficientTokenAllowance.selector);
        batcher.batchSendTokenSameAmount(address(token), recipients, amountPerRecipient);
        vm.stopPrank();
    }

    function testRevertTokenInsufficientBalance() public {
        address poorUser = address(99);
        token.mint(poorUser, 50 * 10**18);

        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;

        uint256 amountPerRecipient = 100 * 10**18;
        uint256 totalAmount = 200 * 10**18;

        vm.startPrank(poorUser);
        token.approve(address(batcher), totalAmount);
        vm.expectRevert(BatchTransfer.InsufficientTokenBalance.selector);
        batcher.batchSendTokenSameAmount(address(token), recipients, amountPerRecipient);
        vm.stopPrank();
    }

    function testRevertTokenZeroAddress() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;

        vm.prank(user);
        vm.expectRevert(BatchTransfer.ZeroAddress.selector);
        batcher.batchSendTokenSameAmount(address(0), recipients, 100);
    }

    function testRevertTokenZeroRecipient() public {
        address[] memory recipients = new address[](0);

        vm.prank(user);
        vm.expectRevert(BatchTransfer.RequireOneRecipient.selector);
        batcher.batchSendTokenSameAmount(address(token), recipients, 100);
    }

    /*//////////////////////////////////////////////////////////////
                            RESCUE FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function testTokenRescue() public {
        uint256 rescueAmount = 1000 * 10**18;
        token.transfer(address(batcher), rescueAmount);

        assertEq(token.balanceOf(address(batcher)), rescueAmount);

        vm.prank(owner);
        batcher.tokenRescue(address(token), owner, rescueAmount);

        assertEq(token.balanceOf(owner), rescueAmount);
        assertEq(token.balanceOf(address(batcher)), 0);
    }

    function testRevertTokenRescueNotOwner() public {
        uint256 rescueAmount = 1000 * 10**18;
        token.transfer(address(batcher), rescueAmount);

        vm.prank(user);
        vm.expectRevert();
        batcher.tokenRescue(address(token), user, rescueAmount);
    }

    function testRevertTokenRescueZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(BatchTransfer.ZeroAddress.selector);
        batcher.tokenRescue(address(token), address(0), 100);
    }

    /*//////////////////////////////////////////////////////////////
                            BATCH SIZE LIMIT TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevertBatchSizeExceeded() public {
        address[] memory recipients = new address[](201);
        for (uint i = 0; i < 201; i++) {
            recipients[i] = address(uint160(i + 100));
        }

        vm.prank(user);
        vm.expectRevert(BatchTransfer.BatchSizeExceeded.selector);
        batcher.batchSendETHSameAmount{value: 0}(recipients, 0);
    }

    function testMaxBatchSizeAllowed() public {
        address[] memory recipients = new address[](200);
        for (uint i = 0; i < 200; i++) {
            recipients[i] = address(uint160(i + 100));
        }

        uint256 amountPerRecipient = 0.01 ether;
        uint256 totalAmount = amountPerRecipient * 200;

        vm.prank(user);
        batcher.batchSendETHSameAmount{value: totalAmount}(recipients, amountPerRecipient);

        assertEq(address(uint160(100)).balance, 0.01 ether);
        assertEq(address(uint160(199)).balance, 0.01 ether);
    }
}