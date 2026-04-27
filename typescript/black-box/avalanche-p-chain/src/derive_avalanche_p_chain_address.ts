import { publicKeyToPChainAddressCompat } from './pchain-address-utils';
import { AVALANCHE_NETWORK } from './pchain-config';
import dotenv from 'dotenv';

dotenv.config()

async function derivePchainAdrress(){
  const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY!, 'base64');
  const address = await publicKeyToPChainAddressCompat(publicKeyBuffer);
  console.log('Your P-Chain address:', address);
  if (AVALANCHE_NETWORK == 'mainnet'){
    console.log(`https://subnets.avax.network/p-chain/address/${address.replace("P-", "")}`)
  } else {
    console.log(console.log(`https://subnets-test.avax.network/p-chain/address/${address.replace("P-", "")}`))
  }

}
derivePchainAdrress();