import { fordefiConfig, callConfig} from './config.js';
import { getProvider } from './get-provider.js';
import { ethers } from 'ethers';

async function main() {
    let provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new ethers.BrowserProvider(provider); 
    const signer = await web3Provider.getSigner();

    const balance = await web3Provider.getBalance(fordefiConfig.address);
    console.log(`Balance of ${fordefiConfig.address}:`, ethers.formatEther(balance), "ETH");
  
    const tx = await signer.sendTransaction({
      to: callConfig.contractAddress,
      data: callConfig.hex_call_data,
      gasLimit: 20_0000n, // make sure to specify a gas limit to avoid validation errors witht he Fordefi API
      maxFeePerGas: 1_000_000_000n, // in wei
      maxPriorityFeePerGas: 100_000_000n, // in wei
    });
    console.log("Transaction hash:", tx.hash);
  
    const receipt = await tx.wait();
    if (receipt) {
      console.log("Transaction confirmed in block:", receipt.blockNumber);
    } else {
      console.log("Transaction receipt is null.");
    }
  }
  
  main().catch(console.error);