// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract BatchTransfer is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    uint256 public constant MAX_BATCH_SIZE = 200;
    
    event BatchETHTransfer(address indexed sender, uint256 totalAmount, uint256 recipients);
    event BatchTokenTransfer(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipients);
    event TokenRescued(address indexed token, address indexed owner, uint amount);

    error ArrayLengthMismatch();
    error BatchSizeExceeded();
    error ZeroAddress();
    error InsufficientTokenAllowance();
    error InsufficientTokenBalance();
    error NoTokenToRescue();
    error ETHSendFailed();
    error RequireOneRecipient();
    error NotEnoughETH();

    constructor(address owner_) Ownable(owner_){}

    /*//////////////////////////////////////////////////////////////
                                ETH Batching
    //////////////////////////////////////////////////////////////*/

    /// @notice Send the same ETH amount to many recipients (EXACT funding required)
    function batchSendETHSameAmount(address[] calldata recipients, uint256 amountPerRecipient) external nonReentrant payable {

        uint256 n = recipients.length;
        if (n == 0) revert RequireOneRecipient();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total = amountPerRecipient * n;
        if(msg.value != total) revert NotEnoughETH();

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();
            (bool ok, ) = to.call{value: amountPerRecipient}("");
            if (!ok) revert ETHSendFailed();
            unchecked { ++i; }
        }

        emit BatchETHTransfer(msg.sender, total, n);
    }

    /// @notice Send different ETH amounts to many recipients (EXACT funding required)
    function batchSendETHDifferentAmounts(address[] calldata recipients, uint256[] calldata amounts) external nonReentrant payable {
        uint256 n = recipients.length;
        if (n == 0) revert RequireOneRecipient();
        if (n != amounts.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total;
        for (uint256 i; i < n; ) {
            total += amounts[i];
            unchecked { ++i; }
        }
        if(msg.value != total) revert NotEnoughETH();

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
                                ERC20 Tokens Batching 
    //////////////////////////////////////////////////////////////*/

    /// @notice Send the same token amount to many recipients
    function batchSendTokenSameAmount(address token, address[] calldata recipients, uint256 amountPerRecipient) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();

        uint256 n = recipients.length;
        if (n == 0) revert RequireOneRecipient();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total = amountPerRecipient * n;

        IERC20 tokenContract = IERC20(token);
        if (tokenContract.allowance(msg.sender, address(this)) < total) revert InsufficientTokenAllowance();
        if (tokenContract.balanceOf(msg.sender) < total) revert InsufficientTokenBalance();

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();
            tokenContract.safeTransferFrom(msg.sender, to, amountPerRecipient);
            unchecked { ++i; }
        }
        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    /// @notice Send different token amounts to many recipients
    function batchSendTokenDifferentAmounts( address token, address[] calldata recipients, uint256[] calldata amounts) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();

        uint256 n = recipients.length;
        if (n == 0) revert RequireOneRecipient();
        if (n != amounts.length) revert ArrayLengthMismatch();
        if (n > MAX_BATCH_SIZE) revert BatchSizeExceeded();

        uint256 total;
        for (uint256 i; i < n; ) {
            total += amounts[i];
            unchecked { ++i; }
        }

        IERC20 tokenContract = IERC20(token);
        if (tokenContract.allowance(msg.sender, address(this)) < total) revert InsufficientTokenAllowance();
        if (tokenContract.balanceOf(msg.sender) < total) revert InsufficientTokenBalance();

        for (uint256 i; i < n; ) {
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();
            tokenContract.safeTransferFrom(msg.sender, to, amounts[i]);
            unchecked { ++i; }
        }

        emit BatchTokenTransfer(msg.sender, token, total, n);
    }

    /// @notice Rescues tokens accidentally sent to the contract:
    function tokenRescue(address token, address to, uint amount) external onlyOwner{
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);

        emit TokenRescued(token, to, amount);

    }
}