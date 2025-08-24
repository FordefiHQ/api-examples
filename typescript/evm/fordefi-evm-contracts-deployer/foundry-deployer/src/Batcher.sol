// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BatchTransfer {
    using SafeERC20 for IERC20;
    uint256 public constant MAX_BATCH_SIZE = 500;
    
    // Events
    event BatchETHTransfer(address indexed sender, uint256 totalAmount, uint256 recipients);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipients);

    // Errors
    error InvalidArrayLength();
    error ArrayLengthMismatch();
    error BatchSizeExceeded();
    error ZeroAddress();
    error InsufficientETH();
    error InsufficientAllowance();
    error ETHSendFailed();

    /*//////////////////////////////////////////////////////////////
                                ETH
    //////////////////////////////////////////////////////////////*/

    /// @notice Send the same ETH amount to many recipients (exact funding required)
    function batchSendETHSameAmount(address[] calldata recipients, uint256 amountPerRecipient)
        external
        payable
    {
        uint256 n = recipients.length;
        if (n == 0) revert InvalidArrayLength();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total = amountPerRecipient * n;
        if (msg.value != total) revert InsufficientETH();

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            (bool ok, ) = to.call{value: amountPerRecipient}("");
            if (!ok) revert ETHSendFailed();

            unchecked { ++i; }
        }

        emit BatchETHTransfer(msg.sender, total, n);
    }

    /// @notice Send different ETH amounts to many recipients (exact funding required)
    function batchSendETHDifferentAmounts(address[] calldata recipients, uint256[] calldata amounts)
        external
        payable
    {
        uint256 n = recipients.length;
        if (n == 0) revert InvalidArrayLength();
        if (n != amounts.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total;
        for (uint256 i; i < n; ) {
            total += amounts[i];
            unchecked { ++i; }
        }
        if (msg.value != total) revert InsufficientETH();

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            (bool ok, ) = to.call{value: amounts[i]}("");
            if (!ok) revert ETHSendFailed();

            unchecked { ++i; }
        }

        emit BatchETHTransfer(msg.sender, total, n);
    }

    /*//////////////////////////////////////////////////////////////
                                TOKENS
    //////////////////////////////////////////////////////////////*/

    /// @notice Send the same token amount to many recipients (pull once, push many)
    function batchSendTokenSameAmount(address token, address[] calldata recipients, uint256 amountPerRecipient)
        external
    {
        if (token == address(0)) revert ZeroAddress();

        uint256 n = recipients.length;
        if (n == 0) revert InvalidArrayLength();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total = amountPerRecipient * n;
        IERC20 tokenContract = IERC20(token);

        // Check allowance before attempting transfer
        if (tokenContract.allowance(msg.sender, address(this)) < total) {
            revert InsufficientAllowance();
        }

        // Pull once from sender into this contract using SafeERC20
        tokenContract.safeTransferFrom(msg.sender, address(this), total);

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            // Push to recipients using SafeERC20
            tokenContract.safeTransfer(to, amountPerRecipient);

            unchecked { ++i; }
        }

        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    /// @notice Send different token amounts to many recipients (pull once, push many)
    function batchSendTokenDifferentAmounts(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (token == address(0)) revert ZeroAddress();

        uint256 n = recipients.length;
        if (n == 0) revert InvalidArrayLength();
        if (n != amounts.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total;
        for (uint256 i; i < n; ) {
            total += amounts[i];
            unchecked { ++i; }
        }

        IERC20 tokenContract = IERC20(token);

        // Check allowance before attempting transfer
        if (tokenContract.allowance(msg.sender, address(this)) < total) {
            revert InsufficientAllowance();
        }

        // Pull once from sender into this contract using SafeERC20
        tokenContract.safeTransferFrom(msg.sender, address(this), total);

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            // Push to recipients using SafeERC20
            tokenContract.safeTransfer(to, amounts[i]);

            unchecked { ++i; }
        }

        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    receive() external payable {}
}