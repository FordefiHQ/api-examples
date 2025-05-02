import { getProvider } from './get-provider-v6';
import { fordefiConfig } from './config'

// Define your EIP-712 domain
const domain = {
  name: 'HelloDapp',                                                // Human-readable name of your domain
  version: '1',                                                     // Version of your domain
  chainId: fordefiConfig.chainId,                                   // EVM chain ID (1 for Ethereum Mainnet)
  verifyingContract: '0x28A2b192810484C19Dd3c8884f0F30AfE4796ad7',  // Contract that will verify the signature
};

// Define your typed data structure
const eip712Types = {
  MyStruct: [
    { name: 'someValue', type: 'uint256' },
    { name: 'someString', type: 'string' },
  ],
};

// The data you want to sign
const myData = {
  someValue: '12345',
  someString: 'Go go Fordefi!',
};

async function main() {
  const provider = await getProvider();
  if (!provider) {
      throw new Error("Failed to initialize provider");
  }
  const signer = await provider.getSigner();
  const signature = await signer.signTypedData(
    domain,
    { MyStruct: eip712Types.MyStruct },
    myData
  );
  console.log('Signature:', signature);
}

main().catch(console.error);