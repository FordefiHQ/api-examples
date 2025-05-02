import { getProvider } from './get-provider';
import { fordefiConfig } from './config'
import dotenv from 'dotenv';
dotenv.config();


// Define your EIP-712 domain
//    Adjust these fields to match your project’s requirements.
const domain = {
  name: 'HelloDapp',                                                // Human-readable name of your domain
  version: '1',                                                     // Version of your domain
  chainId: fordefiConfig.chainId,                                          // EVM chain ID (1 for Ethereum Mainnet)
  verifyingContract: '0x28A2b192810484C19Dd3c8884f0F30AfE4796ad7',  // Contract that will verify the signature
};

// Define your typed data structure
//    Example struct: MyStruct with two fields.
const eip712Types = {
  MyStruct: [
    { name: 'someValue', type: 'uint256' },
    { name: 'someString', type: 'string' },
  ],
};

async function main() {
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }

  // The data you want to sign
  const myData = {
    someValue: '12345',
    someString: 'Go go Fordefi!',
  };

  // Sign the typed data using the `eth_signTypedData_v4` method
  const signerAddress = fordefiConfig.address; // Your Fordefi EVM Vault
  const signer = provider.getSigner(signerAddress);
  const signature = await signer._signTypedData(
    domain, 
    { MyStruct: eip712Types.MyStruct }, 
    myData
  );
  console.log('Signature:', signature);

}

main().catch(console.error);