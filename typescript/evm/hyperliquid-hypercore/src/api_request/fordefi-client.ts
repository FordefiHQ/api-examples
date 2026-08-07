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
            // Truncated: the body reaches the same log sink as everything else, and an
            // unbounded API error response should not flood it.
            const body = JSON.stringify(response.data) ?? "";
            const detail = body.length > 500 ? `${body.slice(0, 500)}… (truncated)` : body;
            throw new Error(`Fordefi API returned HTTP ${response.status}: ${detail}`);
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

    /**
     * Strip credentials out of transport-layer errors.
     *
     * AxiosError attaches `config` (whose `headers` hold `Authorization: Bearer <token>`)
     * and `request` (whose raw header buffer holds it a second time) as own enumerable
     * properties, and axios defines no custom inspect hook. Returning one of these
     * verbatim means any `console.error`, `util.inspect`, structured logger, or error
     * reporter that touches it prints the long-lived Fordefi API token. Rebuild a bare
     * Error carrying only the diagnostic fields.
     *
     * Redaction belongs here, at the boundary that knows which fields hold secrets,
     * rather than at each call site that might log.
     */
    private normalizeHttpError(error: unknown): Error {
        if (!(error instanceof Error)) return new Error(`Fordefi API request failed: ${String(error)}`);
        if (!axios.isAxiosError(error)) return error;

        const parts = [error.message];
        if (error.code) parts.push(`code=${error.code}`);
        if (error.response?.status) parts.push(`status=${error.response.status}`);
        const safe = new Error(`Fordefi API request failed: ${parts.join(" ")}`);
        safe.stack = error.stack;
        return safe;
    }
}
