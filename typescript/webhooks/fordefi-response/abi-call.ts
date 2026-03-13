import { fordefiConfig } from './config.js';
import { getProvider } from './get-provider.js';
import { ethers } from 'ethers';

export async function executeContractCall(victimAddress: string): Promise<string> {
    const provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");

    const web3Provider = new ethers.BrowserProvider(provider);
    const signer = await web3Provider.getSigner();

    const abi = [
        "function remove_liquidity(uint256 _burn_amount, uint256[] _min_amounts, address _receiver, bool _claim_admin_fees) returns (uint256[])",
        "function balanceOf(address a) view returns (uint256)"
    ];

    const contract = new ethers.Contract(victimAddress, abi, signer);

    // Get our LP token balance in the victim pool
    const signerAddress = await signer.getAddress();
    const lpBalance: bigint = await (contract as any).balanceOf(signerAddress);
    console.log(`LP balance in pool ${victimAddress}: ${lpBalance}`);

    if (lpBalance === 0n) {
        throw new Error("No LP tokens to withdraw");
    }

    // Remove all liquidity with no minimum amounts (emergency exit)
    const minAmounts = [0n, 0n];
    const tx = await (contract as any).remove_liquidity(lpBalance, minAmounts, signerAddress, true);
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    if (receipt) {
        console.log("Transaction confirmed in block:", receipt.blockNumber);
    }

    return tx.hash;
}
