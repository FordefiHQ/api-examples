import type { TypedDataDomain, TypedDataField } from "ethers";
import type { FordefiApiConfig } from "./interfaces";
import { buildTypedMessagePayload } from "./api_request/buildPayload";
import { FordefiApiClient } from "./api_request/fordefi-client";

export class SignatureOnlyError extends Error {
    constructor(readonly signature: string) {
        super("Signature obtained (manual mode — not broadcasting)");
        this.name = "SignatureOnlyError";
    }
}

export function findSignatureOnlyError(error: unknown): SignatureOnlyError | null {
    let current: unknown = error;
    while (current) {
        if (current instanceof SignatureOnlyError) return current;
        current = typeof current === "object" && current !== null && "cause" in current
            ? (current as { cause?: unknown }).cause
            : undefined;
    }
    return null;
}

export class FordefiWalletAdapter {
    private readonly apiClient: FordefiApiClient;

    constructor(private readonly config: FordefiApiConfig, apiClient?: FordefiApiClient) {
        this.apiClient = apiClient ?? new FordefiApiClient(config.accessToken, config.privateKeyPath);
    }

    async getAddress(): Promise<string> {
        return this.config.address.toLowerCase();
    }

    async getChainId(): Promise<string> {
        return String(this.config.chainId);
    }

    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, TypedDataField[]>,
        value: Record<string, unknown>,
    ): Promise<string> {
        const modifiedDomain = { ...domain, chainId: this.config.chainId };
        const domainFields: TypedDataField[] = [];
        if (modifiedDomain.name !== undefined) domainFields.push({ name: "name", type: "string" });
        if (modifiedDomain.version !== undefined) domainFields.push({ name: "version", type: "string" });
        if (modifiedDomain.chainId !== undefined) domainFields.push({ name: "chainId", type: "uint256" });
        if (modifiedDomain.verifyingContract !== undefined) domainFields.push({ name: "verifyingContract", type: "address" });
        if (modifiedDomain.salt !== undefined) domainFields.push({ name: "salt", type: "bytes32" });

        const primaryType = Object.keys(types).find((key) => key !== "EIP712Domain");
        if (!primaryType) throw new Error("Typed data must contain a primary type");

        const typedData = {
            types: { EIP712Domain: domainFields, ...types },
            domain: modifiedDomain,
            primaryType,
            message: value,
        };
        const json = JSON.stringify(typedData, (_key, item) => typeof item === "bigint" ? item.toString() : item);
        const rawData = `0x${Buffer.from(json, "utf8").toString("hex")}`;
        const payload = buildTypedMessagePayload(this.config.vaultId, rawData, `evm_${this.config.chainId}`);
        const transaction = await this.apiClient.createTransaction(this.config.pathEndpoint, payload);
        const signatureBase64 = await this.apiClient.waitForSignature(transaction);
        const signature = `0x${Buffer.from(signatureBase64, "base64").toString("hex")}`;

        if (this.config.pushMode === "manual") throw new SignatureOnlyError(signature);
        return signature;
    }
}
