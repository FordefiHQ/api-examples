// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function allowance(address,address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
}

contract BatchTransfer {
    // Events (single, cheap summaries)
    event BatchETHTransfer(address indexed sender, uint256 totalAmount, uint256 recipients);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipients);

    // Custom errors
    error InvalidArrayLength();
    error ArrayLengthMismatch();
    error ZeroAddress();
    error InsufficientETH();
    error ETHSendFailed();
    error ERC20PullFailed();
    error ERC20PushFailed();
    // error FeeOnTransferNotSupported(); // uncomment if you add balance-delta check

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

        uint256 total = amountPerRecipient * n;

        // Pull once from sender into this contract (one allowance update instead of N)
        _safeTransferFrom(token, msg.sender, address(this), total);

        // If supporting fee-on-transfer, measure received vs expected and revert if mismatched:
        // uint256 beforeBal = _balanceOf(token, address(this));
        // _safeTransferFrom(token, msg.sender, address(this), total);
        // if (_balanceOf(token, address(this)) - beforeBal != total) revert FeeOnTransferNotSupported();

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

        uint256 total;
        for (uint256 i; i < n; ) {
            total += amounts[i];
            unchecked { ++i; }
        }

        _safeTransferFrom(token, msg.sender, address(this), total);
        // If fee-on-transfer support needed, add the balance-delta check here.

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();

            _safeTransfer(token, to, amounts[i]);

            unchecked { ++i; }
        }

        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    /*//////////////////////////////////////////////////////////////
                            MIXED (ETH + TOKEN)
    //////////////////////////////////////////////////////////////*/

    /// @notice Send ETH and a single ERC20 in one tx (exact ETH funding required; token uses pull-then-push)
    function batchSendMixed(
        address[] calldata ethRecipients,
        uint256[] calldata ethAmounts,
        address token,
        address[] calldata tokenRecipients,
        uint256[] calldata tokenAmounts
    ) external payable {
        // ---- ETH ----
        if (ethRecipients.length != 0) {
            if (ethRecipients.length != ethAmounts.length) revert ArrayLengthMismatch();

            uint256 ethTotal;
            for (uint256 i; i < ethRecipients.length; ) {
                ethTotal += ethAmounts[i];
                unchecked { ++i; }
            }
            if (msg.value != ethTotal) revert InsufficientETH();

            for (uint256 i; i < ethRecipients.length; ) {
                address to = ethRecipients[i];
                if (to == address(0)) revert ZeroAddress();
                (bool ok, ) = to.call{value: ethAmounts[i]}("");
                if (!ok) revert ETHSendFailed();
                unchecked { ++i; }
            }

            emit BatchETHTransfer(msg.sender, ethTotal, ethRecipients.length);
        }

        // ---- TOKENS ----
        if (tokenRecipients.length != 0) {
            if (token == address(0)) revert ZeroAddress();
            if (tokenRecipients.length != tokenAmounts.length) revert ArrayLengthMismatch();

            uint256 totalTokens;
            for (uint256 i; i < tokenRecipients.length; ) {
                totalTokens += tokenAmounts[i];
                unchecked { ++i; }
            }

            _safeTransferFrom(token, msg.sender, address(this), totalTokens);
            // If fee-on-transfer support needed, add the balance-delta check here.

            for (uint256 i; i < tokenRecipients.length; ) {
                address to = tokenRecipients[i];
                if (to == address(0)) revert ZeroAddress();
                _safeTransfer(token, to, tokenAmounts[i]);
                unchecked { ++i; }
            }

            emit BatchTokenTransfer(msg.sender, token, totalTokens, tokenRecipients.length);
        }
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

    // If you decide to support fee-on-transfer detection, uncomment and use:
    // function _balanceOf(address token, address account) private view returns (uint256) {
    //     (bool ok, bytes memory data) = token.staticcall(
    //         abi.encodeWithSelector(IERC20.balanceOf.selector, account)
    //     );
    //     require(ok && data.length >= 32, "balanceOf failed");
    //     return abi.decode(data, (uint256));
    // }

    receive() external payable {}
}