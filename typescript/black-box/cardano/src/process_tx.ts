import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = 'https://api.fordefi.com';

async function callFordefi(config: AxiosRequestConfig): Promise<AxiosResponse> {
    const resp = await axios({ ...config, validateStatus: () => true });
    if (resp.status < 200 || resp.status >= 300) {
        throw new Error(`Fordefi API ${resp.status}: ${JSON.stringify(resp.data)}`);
    }
    return resp;
}

export async function createAndSignTx(
    path: string,
    accessToken: string,
    signature: string,
    timestamp: number,
    requestBody: string,
): Promise<AxiosResponse> {
    return callFordefi({
        method: 'POST',
        url: `${BASE_URL}${path}`,
        data: requestBody,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'x-signature': signature,
            'x-timestamp': timestamp,
            'Content-Type': 'application/json',
        },
    });
}

export async function get_tx(path: string, accessToken: string, txId: string): Promise<any> {
    const resp = await callFordefi({
        method: 'GET',
        url: `${BASE_URL}${path}/${txId}`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    return resp.data;
}
