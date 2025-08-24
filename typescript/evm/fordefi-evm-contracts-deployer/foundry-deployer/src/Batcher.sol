// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function allowance(address,address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
}

contract BatchTransfer {
    // Constants
    uint256 public constant MAX_BATCH_SIZE = 500; // Reasonable limit to avoid gas issues
    
    // Events (single, cheap summaries)
    event BatchETHTransfer(address indexed sender, uint256 totalAmount, uint256 recipients);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipients);

    // Custom errors
    error InvalidArrayLength();
    error ArrayLengthMismatch();
    error BatchSizeExceeded();
    error ZeroAddress();
    error InsufficientETH();
    error InsufficientAllowance();
    error ETHSendFailed();
    error ERC20PullFailed();
    error ERC20PushFailed();

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

        // exact funding avoids refund branch
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

        // Check allowance before attempting transfer
        uint256 allowance = IERC20(token).allowance(msg.sender, address(this));
        if (allowance < total) revert InsufficientAllowance();

        // Pull once from sender into this contract (one allowance update instead of N)
        _safeTransferFrom(token, msg.sender, address(this), total);

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            _safeTransfer(token, to, amountPerRecipient);

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

        uint256 allowance = IERC20(token).allowance(msg.sender, address(this));
        if (allowance < total) revert InsufficientAllowance();

        _safeTransferFrom(token, msg.sender, address(this), total);

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            _safeTransfer(token, to, amounts[i]);

            unchecked { ++i; }
        }

        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL SAFE TOKEN HELPERS
    //////////////////////////////////////////////////////////////*/

    // Treat empty return data as success; revert on false or low-level failure.
    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ERC20PullFailed();
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ERC20PushFailed();
    }

    receive() external payable {}
}