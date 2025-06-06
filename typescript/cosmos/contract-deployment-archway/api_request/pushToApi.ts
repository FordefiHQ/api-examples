import axios, { AxiosResponse } from 'axios';

export async function createAndSignTx(
  path: string,
  accessToken: string,
  signature: string,
  timestamp: number,
  requestBody: string
): Promise<AxiosResponse> {
  const fordefiApiUrl = "https://api.fordefi.com";
  const url = `${fordefiApiUrl}${path}`;

  try {
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