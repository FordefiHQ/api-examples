import { RelayClient, RelayerTxType } from "@polymarket/builder-relayer-client";
import { JsonRpcSigner } from "@ethersproject/providers";
import { fordefiConfig, RELAYER_HOST, getRelayerAuth } from "./config";

let cachedRelayClient: RelayClient | null = null;

export function getRelayClient(signer: JsonRpcSigner): RelayClient {
    if (cachedRelayClient) {
        return cachedRelayClient;
    }
    const { apiKey, apiKeyAddress } = getRelayerAuth();
    const client = new RelayClient(
        RELAYER_HOST,
        fordefiConfig.chainId as number,
        signer,
        undefined, // no builder credentials — we authenticate with a relayer API key instead
        RelayerTxType.SAFE
    );
    // The SDK only generates builder HMAC headers on its own; relayer API key auth
    // is two static headers, so inject them on the client's axios instance.
    client.httpClient.instance.defaults.headers.common["RELAYER_API_KEY"] = apiKey;
    client.httpClient.instance.defaults.headers.common["RELAYER_API_KEY_ADDRESS"] = apiKeyAddress;
    cachedRelayClient = client;
    return client;
}
