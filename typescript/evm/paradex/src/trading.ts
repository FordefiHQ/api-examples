import * as Paradex from '@paradex/sdk';
import { deriveFromEthSigner } from '@paradex/sdk/dist/account.js';
import { ethers } from 'ethers';
import { Account, SystemConfig } from './utils/types.js';
import { authenticate, onboardUser, createOrder, getOpenOrders, cancelAllOpenOrders, getAccountInfo } from './utils/api.js';
import { PARADEX_API_URL, PARADEX_CHAIN_ID } from './config.js';
import { OrderDetails } from './interfaces.js';

export async function deriveParadexAccount(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig
): Promise<{ account: Account; systemConfig: SystemConfig }> {
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

    return { account, systemConfig };
}

export async function placeOrder(
    signer: ethers.Signer,
    paradexConfig: Paradex.ParadexConfig,
    orderDetails: OrderDetails
) {
    console.log("Setting up trading account...");
    const { account, systemConfig } = await deriveParadexAccount(signer, paradexConfig);
    console.log(`Paradex address: ${account.address}`);

    console.log("Onboarding user...");
    await onboardUser(systemConfig, account);

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
    const { account, systemConfig } = await deriveParadexAccount(signer, paradexConfig);

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
    const { account, systemConfig } = await deriveParadexAccount(signer, paradexConfig);

    const jwtToken = await authenticate(systemConfig, account);
    if (!jwtToken) {
        throw new Error("Authentication failed");
    }
    account.jwtToken = jwtToken;

    await cancelAllOpenOrders(systemConfig, account, market);
}
