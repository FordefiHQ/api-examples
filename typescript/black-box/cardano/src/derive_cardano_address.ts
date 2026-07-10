import dotenv from 'dotenv';
import {
    publicKeyToCardanoAddress,
    publicKeyToEnterpriseAddress,
    publicKeyToStakeAddress,
} from './cardano-address-utils';

dotenv.config();

// Deliberately not importing cardano-config: deriving addresses needs only the
// public key, and config requires ./secret/private.pem to exist.
const CARDANO_NETWORK = process.env.CARDANO_NETWORK || 'mainnet';

function deriveCardanoAddress() {
    if (!process.env.VAULT_PUBLIC_KEY) throw new Error('VAULT_PUBLIC_KEY is required');
    const publicKeyBuffer = Buffer.from(process.env.VAULT_PUBLIC_KEY, 'base64');

    const baseAddress = publicKeyToCardanoAddress(publicKeyBuffer, CARDANO_NETWORK);
    const stakeAddress = publicKeyToStakeAddress(publicKeyBuffer, CARDANO_NETWORK);
    const enterpriseAddress = publicKeyToEnterpriseAddress(publicKeyBuffer, CARDANO_NETWORK);

    const explorerHost = CARDANO_NETWORK === 'mainnet' ? 'cardanoscan.io' : 'preprod.cardanoscan.io';
    console.log('Base address (fund this one — used by all flows, earns staking rewards):');
    console.log(`  ${baseAddress}`);
    console.log(`  https://${explorerHost}/address/${baseAddress}`);
    console.log('\nStake address (reward account):');
    console.log(`  ${stakeAddress}`);
    console.log(`  https://${explorerHost}/stakeKey/${stakeAddress}`);
    console.log('\nEnterprise address (same key, no staking — not used by the flows):');
    console.log(`  ${enterpriseAddress}`);
}

deriveCardanoAddress();
