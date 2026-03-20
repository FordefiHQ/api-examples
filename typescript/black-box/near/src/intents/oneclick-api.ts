import axios from "axios";
import {
    OneClickQuoteRequest,
    OneClickQuoteResponse,
    OneClickToken,
    OneClickStatus,
    OneClickStatusResponse,
} from "./intents-interfaces";

const BASE_URL = "https://1click.chaindefuser.com/v0";

// Simple in-memory cache for tokens (5-min TTL)
let tokenCache: OneClickToken[] | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchTokens(): Promise<OneClickToken[]> {
    const now = Date.now();
    if (tokenCache && now - tokenCacheTime < TOKEN_CACHE_TTL_MS) {
        return tokenCache;
    }

    const response = await axios.get<OneClickToken[]>(`${BASE_URL}/tokens`);
    tokenCache = response.data;
    tokenCacheTime = now;
    return tokenCache;
}

export function findToken(
    tokens: OneClickToken[],
    symbol: string,
    blockchain?: string
): OneClickToken | undefined {
    return tokens.find(
        (t) =>
            t.symbol.toLowerCase() === symbol.toLowerCase() &&
            (!blockchain || t.blockchain.toLowerCase() === blockchain.toLowerCase())
    );
}

export async function getQuote(
    request: OneClickQuoteRequest,
    apiKey?: string
): Promise<OneClickQuoteResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await axios.post<OneClickQuoteResponse>(
        `${BASE_URL}/quote`,
        request,
        { headers }
    );
    return response.data;
}

export async function submitDeposit(
    depositAddress: string,
    txHash: string,
    nearSenderAccount?: string
): Promise<void> {
    const body: Record<string, string> = {
        depositAddress,
        txHash,
    };
    if (nearSenderAccount) {
        body.nearSenderAccount = nearSenderAccount;
    }
    await axios.post(`${BASE_URL}/deposit/submit`, body);
}

const TERMINAL_STATUSES = new Set<OneClickStatus>([
    "SUCCESS",
    "FAILED",
    "REFUNDED",
    "INCOMPLETE_DEPOSIT",
]);

export async function pollStatus(
    depositAddress: string,
    apiKey?: string,
    timeoutMs: number = 600_000,
    intervalMs: number = 5_000
): Promise<OneClickStatusResponse> {
    const deadline = Date.now() + timeoutMs;
    const headers: Record<string, string> = {};
    if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    while (Date.now() < deadline) {
        const response = await axios.get<OneClickStatusResponse>(
            `${BASE_URL}/status`,
            { params: { depositAddress }, headers }
        );

        const status = response.data;
        console.log(`1Click status: ${status.status}`);

        if (TERMINAL_STATUSES.has(status.status)) {
            return status;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
        `1Click swap timed out after ${timeoutMs / 1000}s. Deposit address: ${depositAddress}`
    );
}
