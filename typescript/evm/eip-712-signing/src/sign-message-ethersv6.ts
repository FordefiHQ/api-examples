import { fordefiConfig, eip712TypedData } from './config';
import { getProvider } from './get-provider';
import { ethers } from 'ethers';


async function main() {
  let provider = await getProvider(fordefiConfig);
  if (!provider) {
    throw new Error("Failed to initialize provider");
  }
  let web3Provider = new ethers.BrowserProvider(provider); 
  const signer = await web3Provider.getSigner();

  const signature = await signer.signTypedData(
    eip712TypedData.domain,
    eip712TypedData.types,
    eip712TypedData.message
  );
  console.log('Signature:', signature);
}

main().catch(console.error);