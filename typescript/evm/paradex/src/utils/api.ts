import axios, { AxiosError } from "axios";

import { Account, SystemConfig } from "./types.js";
import { signAuthRequest, signOnboardingRequest, signOrder } from "./signature.js";

function handleError(error: AxiosError) {
  console.error(error.response);
}

export async function onboardUser(config: SystemConfig, account: Account) {
  const timestamp = Date.now();
  const signature = signOnboardingRequest(config, account);

  const inputBody = JSON.stringify({
    public_key: account.publicKey,
  });

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "PARADEX-ETHEREUM-ACCOUNT": account.ethereumAccount,
    "PARADEX-STARKNET-ACCOUNT": account.address,
    "PARADEX-STARKNET-SIGNATURE": signature,
    "PARADEX-TIMESTAMP": timestamp,
  };

  try {
    await axios.post(`${config.apiBaseUrl}/onboarding`, inputBody, { headers });
    console.log("Onboarding successful");
  } catch (e) {
    handleError(e as AxiosError);
  }
}

export async function authenticate(config: SystemConfig, account: Account) {
  const { signature, timestamp, expiration } = signAuthRequest(config, account);
  const headers = {
    Accept: "application/json",
    "PARADEX-STARKNET-ACCOUNT": account.address,
    "PARADEX-STARKNET-SIGNATURE": signature,
    "PARADEX-TIMESTAMP": timestamp,
    "PARADEX-SIGNATURE-EXPIRATION": expiration,
  };

  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/auth`,
      {},
      { headers }
    );
    return response.data.jwt_token;
  } catch (e) {
    handleError(e as AxiosError);
    return null;
  }
}

export async function isAccountOnboarded(config: SystemConfig, account: Account): Promise<boolean> {
  const { signature, timestamp, expiration } = signAuthRequest(config, account);
  const headers = {
    Accept: "application/json",
    "PARADEX-STARKNET-ACCOUNT": account.address,
    "PARADEX-STARKNET-SIGNATURE": signature,
    "PARADEX-TIMESTAMP": timestamp,
    "PARADEX-SIGNATURE-EXPIRATION": expiration,
  };

  try {
    await axios.post(`${config.apiBaseUrl}/auth`, {}, { headers });
    return true;
  } catch (e) {
    return false;
  }
}

export async function createOrder(
  config: SystemConfig,
  account: Account,
  orderDetails: Record<string, string>
) {
  const timestamp = Date.now();
  const signature = signOrder(config, account, orderDetails, timestamp);

  const inputBody = JSON.stringify({
    ...orderDetails,
    signature: signature,
    signature_timestamp: timestamp,
  });

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${account.jwtToken}`,
  };

  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/orders`,
      inputBody,
      { headers }
    );
    console.log("Order created:", response.data);
  } catch (e) {
    handleError(e as AxiosError);
  }
}

export async function getOpenOrders(config: SystemConfig, account: Account) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${account.jwtToken}`,
  };

  try {
    const response = await axios.get(`${config.apiBaseUrl}/orders`, {
      headers,
    });
    console.log("Open Orders:", response.data);
  } catch (e) {
    handleError(e as AxiosError);
  }
}

export async function cancelAllOpenOrders(
  config: SystemConfig,
  account: Account,
  market?: string
) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${account.jwtToken}`,
  };

  const url = market
    ? `${config.apiBaseUrl}/orders?market=${market}`
    : `${config.apiBaseUrl}/orders`;

  try {
    const response = await axios.delete(url, { headers });
    console.log("All open orders cancelled:", response.data);
    return response.data;
  } catch (e) {
    handleError(e as AxiosError);
  }
}

export async function listAvailableMarkets(
  config: SystemConfig,
  market?: string
) {
  const headers = {
    Accept: "application/json",
  };

  try {
    const url = market
      ? `${config.apiBaseUrl}/markets?market=${market}`
      : `${config.apiBaseUrl}/markets`;

    const response = await axios.get(url, { headers });
    console.log("Available Markets:", response.data);
  } catch (e) {
    handleError(e as AxiosError);
  }
}

export async function getAccountInfo(config: SystemConfig, account: Account) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${account.jwtToken}`,
  };

  try {
    const response = await axios.get(`${config.apiBaseUrl}/account`, {
      headers,
    });
    console.log("Account Info:", response.data);
  } catch (e) {
    handleError(e as AxiosError);
  }
}
