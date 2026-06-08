import axios, { AxiosResponse } from 'axios';

/**
 * Fetch a Fordefi transaction by id. Only the API User access token is required
 * (read-only GET — no request signing needed).
 *
 * @param txId        - Fordefi transaction UUID returned by the create call
 * @param accessToken - Fordefi API User token
 */
export async function getTransaction(
  txId: string,
  accessToken: string,
): Promise<AxiosResponse> {
  const url = `https://api.fordefi.com/api/v1/transactions/${txId}`;

  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(
      `HTTP error occurred: status = ${resp.status}\nError details: ${JSON.stringify(resp.data)}`,
    );
  }

  return resp;
}
