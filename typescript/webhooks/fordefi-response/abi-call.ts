import { fordefiConfig, CONTRACT_ADDRESS, DECIMALS, DESTINATION_ADDRESS } from './config.js';
import { getProvider } from './get-provider.js';
import { ethers } from 'ethers';

export async function executeContractCall(): Promise<string> {
    const provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");

    const web3Provider = new ethers.BrowserProvider(provider);
    const signer = await web3Provider.getSigner();

    const abi = [
        "function transfer(address to, uint amount)",
        "function balanceOf(address a) view returns (uint)"
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
    const amount = ethers.parseUnits("0.01", DECIMALS);
    const tx = await (contract as any).transfer(DESTINATION_ADDRESS, amount);
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    if (receipt) {
        console.log("Transaction confirmed in block:", receipt.blockNumber);
    }

    return tx.hash;
}
