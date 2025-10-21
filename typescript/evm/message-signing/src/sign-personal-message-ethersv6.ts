import { fordefiConfig } from './config';
import { getProvider } from './get-provider';
import { ethers } from 'ethers';

async function main() {
  let provider = await getProvider(fordefiConfig);
  if (!provider) {
    throw new Error("Failed to initialize provider");
  }
  
  let web3Provider = new ethers.BrowserProvider(provider); 
  const signer = await web3Provider.getSigner();

  const message = "Go go Fordefi!";
  
  const signature = await signer.signMessage(message);
  
  console.log('Message:', message);
  console.log('Signature:', signature);
  
  // Optional: Verify the signature
  const signerAddress = await signer.getAddress();
  const recoveredAddress = ethers.verifyMessage(message, signature);
  
  console.log('Signer Address:', signerAddress);
  console.log('Recovered Address:', recoveredAddress);
  console.log('Signature Valid:', signerAddress.toLowerCase() === recoveredAddress.toLowerCase());
}

main().catch(console.error);