import { getProvider } from './get-provider-v6';
import { fordefiConfig } from './config'
import dotenv from 'dotenv';

dotenv.config();

// Define your EIP-712 domain
//    Adjust these fields to match your project’s requirements.
const domain = {
  name: 'HelloDapp',                                                // Human-readable name of your domain
  version: '1',                                                     // Version of your domain
  chainId: fordefiConfig.chainId,                                   // EVM chain ID (1 for Ethereum Mainnet)
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

// This function prepares the typed data payload
function prepareTypedData(data: any) {
  return {
    domain,
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...eip712Types,
    },
    primaryType: 'MyStruct',
    message: data,
  };
}

async function main() {
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }
  const signer = await provider.getSigner();

  // The data you want to sign
  const myData = {
    someValue: '12345',
    someString: 'Go go Fordefi!',
  };

  // Prepare the data for EIP-712 signing
  const typedData = prepareTypedData(myData);

  // Sign the typed data:
  const signature = await signer.signTypedData(
    typedData.domain,
    { MyStruct: eip712Types.MyStruct },
    typedData.message
  );
  console.log('Signature:', signature);

}

main().catch(console.error);