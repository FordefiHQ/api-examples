import axios, { AxiosResponse } from 'axios';

const FORDEFI_API_URL = "https://api.fordefi.com";

export async function createAndSignTx(
  path: string,
  accessToken: string,
  signature: string,
  timestamp: number,
  requestBody: string
): Promise<AxiosResponse> {
  const url = `${FORDEFI_API_URL}${path}`;

  try {
    console.log("Sending transaction to Fordefi 🏰")
    const respTx = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
    };

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
    };
    throw new Error(`Network error occurred: ${error.message ?? error}`);
  }
}

export async function pollForTxHash(
  txId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<string> {
  const url = `${FORDEFI_API_URL}/api/v1/transactions/${txId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const hash = response.data?.hash;
    if (hash) {
      return hash;
    }

    console.log(`Waiting for tx hash... (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for transaction hash after ${maxAttempts} attempts`);
}