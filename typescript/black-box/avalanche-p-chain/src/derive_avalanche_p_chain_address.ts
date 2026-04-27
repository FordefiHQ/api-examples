import dotenv from 'dotenv';
import { publicKeyToPChainAddressCompat } from './pchain-address-utils';
import { AVALANCHE_NETWORK } from './pchain-config';

dotenv.config();

async function derivePChainAddress() {
    if (!process.env.VAULT_PUBLIC_KEY) throw new Error('VAULT_PUBLIC_KEY is required');
    const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY, 'base64');
    const address = await publicKeyToPChainAddressCompat(publicKeyBuffer);
    console.log('Your P-Chain address:', address);

    const explorerHost =
        AVALANCHE_NETWORK === 'mainnet' ? 'subnets.avax.network' : 'subnets-test.avax.network';
    console.log(`https://${explorerHost}/p-chain/address/${address.replace('P-', '')}`);
}

derivePChainAddress();
