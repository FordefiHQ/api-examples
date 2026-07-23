import fs from "fs";
import { HOST } from "./config";
import { ApiKeyCreds, Chain, ClobClient, SignatureTypeV2 } from "@polymarket/clob-client-v2";
import { JsonRpcSigner } from "@ethersproject/providers";
import { FordefiProviderConfig } from "@fordefi/web3-provider";

let cachedClient: ClobClient | null = null;

// CLOB API credentials are deterministic per wallet, so they are cached on
// disk after the first derivation — repeat runs then need zero ClobAuth
// signatures from the vault. The cache lives next to the API signer key in
// the gitignored fordefi_secret/ directory.
const CREDS_CACHE_PATH = "./fordefi_secret/clob-creds.json";

function loadCachedCreds(address: string): ApiKeyCreds | null {
    try {
        const all = JSON.parse(fs.readFileSync(CREDS_CACHE_PATH, "utf8"));
        return all[address.toLowerCase()] ?? null;
    } catch {
        return null;
    }
}

function saveCachedCreds(address: string, creds: ApiKeyCreds) {
    let all: Record<string, ApiKeyCreds> = {};
    try {
        all = JSON.parse(fs.readFileSync(CREDS_CACHE_PATH, "utf8"));
    } catch { /* first write */ }
    all[address.toLowerCase()] = creds;
    fs.writeFileSync(CREDS_CACHE_PATH, JSON.stringify(all, null, 2));
}

async function getApiCreds(signer: JsonRpcSigner, chain: Chain, address: string): Promise<ApiKeyCreds> {
    const cached = loadCachedCreds(address);
    if (cached?.key) {
        return cached;
    }
    const tempClient = new ClobClient({ host: HOST, chain, signer });
    // deriveApiKey re-derives an existing key; only brand-new accounts need
    // the createApiKey fallback (one extra signature, once ever)
    let apiCreds = await tempClient.deriveApiKey();
    if (!apiCreds.key) {
        apiCreds = await tempClient.createApiKey();
    }
    if (!apiCreds.key) {
        throw new Error(`Failed to create or derive CLOB API credentials: ${JSON.stringify(apiCreds)}`);
    }
    saveCachedCreds(address, apiCreds);
    return apiCreds;
}

export async function getPolymarketClient(
    signer: JsonRpcSigner,
    fordefiConfig: FordefiProviderConfig,
    signatureType: SignatureTypeV2,
    funderAddress: string
){
        if (cachedClient) {
            return cachedClient;
        }
        const chain = fordefiConfig.chainId as Chain;
        const apiCreds = await getApiCreds(signer, chain, fordefiConfig.address);
        console.log(`API credentials: ${apiCreds.key}`);
        const client = new ClobClient({
            host: HOST,
            chain,
            signer,
            creds: apiCreds,
            signatureType,
            funderAddress,
        });
        console.log(`Polymarket client initialized on chain ${client.chainId}`);
        cachedClient = client;
        return client;

}
