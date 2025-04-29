import { ethers } from 'ethers';

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ];


export async function approveGPv2VaultRelayer(signer: any, tokenAddress: string, approvedContract: string) {
    console.log(`Approving ${approvedContract} to spend token (${tokenAddress})`);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    // Approve max uint256 value
    const maxApproval = ethers.constants.MaxUint256;
    
    // Send approval transaction
    const tx = await tokenContract.approve(approvedContract, maxApproval);
    console.log(`Approval transaction submitted: ${tx.hash}`);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log(`Approval confirmed in block ${receipt.blockNumber}`);
    
    return receipt;
  }