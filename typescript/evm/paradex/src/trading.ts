import { ethers } from 'ethers';
import * as Paradex from '@paradex/sdk';
import { OrderDetails } from './interfaces.js';
import { Account, SystemConfig } from './utils/types.js';
import { PARADEX_API_URL, PARADEX_CHAIN_ID } from './config.js';
import { deriveFromEthSigner } from '@paradex/sdk/dist/account.js';
import { authenticate, onboardUser, isAccountOnboarded, createOrder, getOpenOrders, cancelAllOpenOrders, getAccountInfo } from './utils/api.js';

let cachedAccount: { account: Account; systemConfig: SystemConfig } | null = null;

async function getOrCreateAccount(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig
): Promise<{ account: Account; systemConfig: SystemConfig }> {
    if (cachedAccount) {
        console.log(`Using cached Paradex account: ${cachedAccount.account.address}`);
        return cachedAccount;
    }

    console.log("Deriving Paradex account...");
    const ethereumAddress = await signer.getAddress();
    const paradexSigner = Paradex.Signer.fromEthers(signer);

    const starknetCredentials = await deriveFromEthSigner({
        config: paradexConfig,
        signer: paradexSigner
    });

    const { ec } = await import('starknet');
    const starknetPublicKey = ec.starkCurve.getStarkKey(starknetCredentials.privateKey);

    const account: Account = {
        address: starknetCredentials.address,
        publicKey: starknetPublicKey,
        ethereumAccount: ethereumAddress,
        privateKey: starknetCredentials.privateKey
    };

    const systemConfig: SystemConfig = {
        apiBaseUrl: PARADEX_API_URL,
        starknet: {
            chainId: PARADEX_CHAIN_ID
        }
    };

    cachedAccount = { account, systemConfig };
    console.log(`Paradex address: ${account.address}`);
    return cachedAccount;
}

export async function onboardAccount(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig
) {
    const { account, systemConfig } = await getOrCreateAccount(signer, paradexConfig);

    console.log("Checking onboarding status...");
    const alreadyOnboarded = await isAccountOnboarded(systemConfig, account);

    if (alreadyOnboarded) {
        console.log("Account already onboarded");
        return;
    }

    console.log("Onboarding user...");
    await onboardUser(systemConfig, account);
}

export async function placeOrder(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig,
    orderDetails: OrderDetails
) {
    const { account, systemConfig } = await getOrCreateAccount(signer, paradexConfig);

    console.log("Checking onboarding status...");
    const alreadyOnboarded = await isAccountOnboarded(systemConfig, account);

    if (!alreadyOnboarded) {
        console.log("Onboarding user...");
        await onboardUser(systemConfig, account);
    } else {
        console.log("Account already onboarded");
    }

    console.log("Authenticating...");
    const jwtToken = await authenticate(systemConfig, account);
    if (!jwtToken) {
        throw new Error("Authentication failed");
    }
    account.jwtToken = jwtToken;
    console.log("Authenticated successfully");

    console.log(`Placing ${orderDetails.side} ${orderDetails.type} order...`);
    const orderPayload: Record<string, string> = {
        market: orderDetails.market,
        side: orderDetails.side,
        type: orderDetails.type,
        size: orderDetails.size,
    };

    if (orderDetails.type === "LIMIT" && orderDetails.price) {
        orderPayload.price = orderDetails.price;
    }

    await createOrder(systemConfig, account, orderPayload);
}

export async function getAccountStatus(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig
) {
    const { account, systemConfig } = await getOrCreateAccount(signer, paradexConfig);

    const jwtToken = await authenticate(systemConfig, account);
    if (!jwtToken) {
        throw new Error("Authentication failed");
    }
    account.jwtToken = jwtToken;

    await getAccountInfo(systemConfig, account);
    await getOpenOrders(systemConfig, account);
}

export async function cancelOrders(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig,
    market?: string
) {
    const { account, systemConfig } = await getOrCreateAccount(signer, paradexConfig);

    const jwtToken = await authenticate(systemConfig, account);
    if (!jwtToken) {
        throw new Error("Authentication failed");
    }
    account.jwtToken = jwtToken;

    await cancelAllOpenOrders(systemConfig, account, market);
}
