import { fordefiConfig, CONTRACT_ADDRESS, DECIMALS, DESTINATION_ADDRESS } from './config';
import { getProvider } from './get-provider';
import { ethers } from 'ethers';

async function main() {
    let provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");
    let web3Provider = new ethers.BrowserProvider(provider); 
    const signer = await web3Provider.getSigner();

    let abi = [
        "function transfer(address to, uint amount)",
        "function balanceOf(address a) view returns (uint)"
    ]

    // Write ops
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
    const amount = ethers.parseUnits("0.01", DECIMALS);
    const tx = await (contract as any).transfer(DESTINATION_ADDRESS, amount)
    console.log("Transaction hash:", tx.hash);
  
    const receipt = await tx.wait();
    if (receipt) {
      console.log("Transaction confirmed in block:", receipt.blockNumber);
    } else {
      console.log("Transaction receipt is null.");
    }

    // Read ops 
    // const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, web3Provider)
    // const balance = await contract.balanceOf(fordefiConfig.address)
    // const humanReadableBalance = ethers.formatUnits(balance, DECIMALS)
    // console.log("Result is: ", humanReadableBalance)

  }
  
  main().catch(console.error);