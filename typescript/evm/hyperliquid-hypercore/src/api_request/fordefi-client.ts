import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { signWithApiUserPrivateKey } from "./signer";

export interface FordefiTransaction {
    id: string;
    state?: string;
    signatures?: string[];
    has_timed_out?: boolean;
    hash?: string;
}

export interface FordefiHttpClient {
    get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}

export interface PollOptions {
    maxAttempts?: number;
    intervalMs?: number;
}

type Sleep = (milliseconds: number) => Promise<void>;
type RequestSigner = (privateKeyPath: string, payload: string) => Promise<string>;

const FAILURE_STATES = new Set(["failed", "aborted", "rejected", "error"]);
const SUCCESS_STATES = new Set(["completed", "mined", "confirmed"]);

export class FordefiApiClient {
    constructor(
        private readonly accessToken: string,
        private readonly privateKeyPath: string,
        private readonly http: FordefiHttpClient = axios,
        private readonly sleep: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
        private readonly baseUrl = "https://api.fordefi.com",
        private readonly requestSigner: RequestSigner = signWithApiUserPrivateKey,
    ) {}

    private async headers(path: string, body = "") {
        const timestamp = Date.now();
        const signature = await this.requestSigner(this.privateKeyPath, `${path}|${timestamp}|${body}`);
        return {
            Authorization: `Bearer ${this.accessToken}`,
            "x-signature": signature,
            "x-timestamp": timestamp,
            ...(body ? { "Content-Type": "application/json" } : {}),
        };
    }

    private assertSuccessful<T>(response: AxiosResponse<T>): T {
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Fordefi API returned HTTP ${response.status}: ${JSON.stringify(response.data)}`);
        }
        return response.data;
    }

    async createTransaction(path: string, payload: unknown): Promise<FordefiTransaction> {
        const body = JSON.stringify(payload);
        try {
            const response = await this.http.post<FordefiTransaction>(`${this.baseUrl}${path}`, body, {
                headers: await this.headers(path, body),
                validateStatus: () => true,
            });
            return this.assertSuccessful(response);
        } catch (error) {
            throw this.normalizeHttpError(error);
        }
    }

    async getTransaction(id: string): Promise<FordefiTransaction> {
        const path = `/api/v1/transactions/${id}`;
        try {
            const response = await this.http.get<FordefiTransaction>(`${this.baseUrl}${path}`, {
                headers: await this.headers(path),
                validateStatus: () => true,
            });
            return this.assertSuccessful(response);
        } catch (error) {
            throw this.normalizeHttpError(error);
        }
    }

    async waitForSignature(initial: FordefiTransaction, options: PollOptions = {}): Promise<string> {
        const { maxAttempts = 15, intervalMs = 2_000 } = options;
        let transaction = initial;

        for (let attempt = 0; attempt <= maxAttempts; attempt++) {
            if (transaction.has_timed_out && transaction.state?.toLowerCase() === "waiting_for_approval") {
                throw new Error(`Signing request ${transaction.id} timed out while waiting for approval`);
            }
            const signature = transaction.signatures?.[0];
            if (signature) return signature;
            this.assertNotFailed(transaction, "Signing request");
            if (attempt === maxAttempts) break;
            await this.sleep(intervalMs);
            transaction = await this.getTransaction(transaction.id);
        }
        throw new Error(`No signature for transaction ${initial.id} after ${maxAttempts} polls`);
    }

    async waitForTerminal(initial: FordefiTransaction, options: PollOptions = {}): Promise<FordefiTransaction> {
        const { maxAttempts = 30, intervalMs = 3_000 } = options;
        let transaction = initial;

        for (let attempt = 0; attempt <= maxAttempts; attempt++) {
            this.assertNotFailed(transaction, "Transaction");
            if (SUCCESS_STATES.has(transaction.state?.toLowerCase() ?? "")) return transaction;
            if (attempt === maxAttempts) break;
            await this.sleep(intervalMs);
            transaction = await this.getTransaction(transaction.id);
        }
        throw new Error(
            `Transaction ${initial.id} did not reach a terminal state after ${maxAttempts} polls. Last state: ${transaction.state ?? "unknown"}`,
        );
    }

    private assertNotFailed(transaction: FordefiTransaction, label: string): void {
        const state = transaction.state?.toLowerCase() ?? "";
        if (FAILURE_STATES.has(state)) throw new Error(`${label} ${transaction.id} failed with state: ${transaction.state}`);
    }

    private normalizeHttpError(error: unknown): Error {
        if (error instanceof Error) return error;
        return new Error(`Fordefi API request failed: ${String(error)}`);
    }
}
