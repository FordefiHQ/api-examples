import dotenv from 'dotenv';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { publicKeyToPolkadotAddress } from './polkadot-address-utils';

dotenv.config();

// Deliberately not importing polkadot-config: deriving the address needs only the
// public key, and config requires ./secret/private.pem to exist.
const POLKADOT_NETWORK = (process.env.POLKADOT_NETWORK || 'polkadot') as 'polkadot' | 'westend';
const NETWORKS = {
    polkadot: { ss58Prefix: 0, subscanHost: 'assethub-polkadot.subscan.io' },
    westend: { ss58Prefix: 42, subscanHost: 'assethub-westend.subscan.io' },
} as const;

async function derivePolkadotAddress() {
    if (!process.env.VAULT_PUBLIC_KEY) throw new Error('VAULT_PUBLIC_KEY is required');
    await cryptoWaitReady();

    const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY, 'base64');
    const { ss58Prefix, subscanHost } = NETWORKS[POLKADOT_NETWORK];
    const address = publicKeyToPolkadotAddress(publicKeyBuffer, ss58Prefix);

    console.log(`Your Polkadot address (${POLKADOT_NETWORK} / Asset Hub):`, address);
    console.log(`https://${subscanHost}/account/${address}`);
    console.log('\nNote: post-AHM, DOT balances live on Asset Hub — fund this account there.');
}

derivePolkadotAddress();
