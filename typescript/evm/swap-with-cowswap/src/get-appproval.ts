import { ethers } from 'ethers';

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
  ];

export async function approveGPv2VaultRelayer(provider: ethers.providers.JsonRpcProvider , signer: ethers.providers.JsonRpcSigner, tokenAddress: string, approvedContract: string) {
    console.log(`Approving ${approvedContract} to spend token (${tokenAddress})`);
    
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const maxApproval = ethers.constants.MaxUint256;

    const tx = await tokenContract.approve(approvedContract, maxApproval);
    console.log(`Approval transaction submitted: ${tx.hash}`);
    
    const receipt = await provider.waitForTransaction(tx.hash, 1); // 1 confirmation;
    
    return receipt;
  }