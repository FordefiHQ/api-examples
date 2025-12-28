import axios, { AxiosResponse } from 'axios';
import { FordefiSolanaConfig } from './config';

export async function postTx(
  fordefiConfig: FordefiSolanaConfig,
  signature: string,
  timestamp: number,
  requestBody: string
): Promise<AxiosResponse> {
  const url = `https://api.fordefi.com${fordefiConfig.apiPathEndpoint}`;

  try {
    const respTx = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${fordefiConfig.accessToken}`,
        'x-signature': signature,
        'x-timestamp': timestamp,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    if (respTx.status < 200 || respTx.status >= 300) {
      let errorMessage = `HTTP error occurred: status = ${respTx.status}`;
      try {
        const errorDetail = respTx.data;
        errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
      } catch {
        errorMessage += `\nRaw response: ${respTx.data}`;
      }
      throw new Error(errorMessage);
    }

    return respTx;
  } catch (error: any) {
    if (error.response) {
      let errorMessage = `HTTP error occurred: status = ${error.response.status}`;
      try {
        const errorDetail = error.response.data;
        errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
      } catch {
        errorMessage += `\nRaw response: ${error.response.data}`;
      }
      throw new Error(errorMessage);
    }
    throw new Error(`Network error occurred: ${error.message ?? error}`);
  }
};

export async function getTx(
  path: string,
  accessToken: string,
): Promise<any> {
  const url = `https://api.fordefi.com${path}`;

  try {
    const respTx = await axios.request({
      method: 'GET',
      url,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });

    if (respTx.status < 200 || respTx.status >= 300) {
      let errorMessage = `HTTP error occurred: status = ${respTx.status}`;
      try {
        const errorDetail = respTx.data;
        errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
      } catch {
        errorMessage += `\nRaw response: ${respTx.data}`;
      }
      throw new Error(errorMessage);
    }

    return respTx.data;
  } catch (error: any) {
    if (error.response) {
      let errorMessage = `HTTP error occurred: status = ${error.response.status}`;
      try {
        const errorDetail = error.response.data;
        errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
      } catch {
        errorMessage += `\nRaw response: ${error.response.data}`;
      }
      throw new Error(errorMessage);
    }
    throw new Error(`Network error occurred: ${error.message ?? error}`);
  }
}

export async function pollForSignedTransaction(
  txId: string,
  accessToken: string,
  maxAttempts = 50,
  intervalMs = 2000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const txData = await getTx(`/api/v1/transactions/${txId}`, accessToken);

    if (txData.state === 'signed' || txData.state === 'pushed' || txData.state === 'mined') {
      const rawTx = txData.solana_transaction?.raw_transaction
        || txData.raw_transaction
        || txData.details?.raw_transaction;

      if (rawTx) {
        return rawTx;
      }
      throw new Error(`Transaction ${txId} is signed but no raw_transaction found in response`);
    }

    if (txData.state === 'failed' || txData.state === 'aborted') {
      throw new Error(`Transaction ${txId} failed with state: ${txData.state}`);
    }

    console.log(`Waiting for signature... (attempt ${attempt + 1}/${maxAttempts}, state: ${txData.state})`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for transaction ${txId} to be signed`);
}