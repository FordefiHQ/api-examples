import { TypedDataDomain, TypedDataField } from 'ethers';
import { FordefiApiConfig, fordefiConfig } from './config';
import { buildTypedMessagePayload } from './api_request/buildPayload';
import { signWithApiUserPrivateKey } from './api_request/signer';
import { createAndSignTx } from './api_request/pushToApi';

/**
 * Custom wallet adapter for Fordefi integration with Hyperliquid.
 *
 * Instead of wrapping an ethers.js signer, this adapter calls the Fordefi API
 * directly for EIP-712 typed data signing. This gives full control over payload
 * fields like push_mode, and allows extracting raw signatures.
 *
 * CHAINID REQUIREMENTS:
 *
 * chainId 1337 - Works for ALL actions EXCEPT deposit:
 *   - vault_transfer, approve_agent, revoke_agent
 *   - withdraw, sendUsd, spotTransfer, placeOrder
 *
 * chainId 42161 - REQUIRED for deposit only (Arbitrum on-chain transaction)
 */
export class FordefiWalletAdapter {
    private config: FordefiApiConfig;

    constructor(config: FordefiApiConfig) {
        this.config = config;
    }

    async getAddress(): Promise<string> {
        return this.config.address.toLowerCase();
    }

    async getChainId(): Promise<string> {
        return String(this.config.chainId);
    }

    /**
     * Sign EIP-712 typed data via the Fordefi API.
     *
     * Overrides the domain chainId with the configured value (1337 for most HL actions),
     * constructs the full EIP-712 JSON, sends it to Fordefi for MPC signing,
     * and returns the raw signature.
     */
    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        console.log("Signing with domain:", JSON.stringify(domain, null, 2));
        console.log("Types:", JSON.stringify(types, null, 2));
        console.log("Value:", JSON.stringify(value, null, 2));

        // Override chainId with the configured value
        const modifiedDomain = {
            ...domain,
            chainId: this.config.chainId,
        };

        console.log("Signing with chainId:", this.config.chainId);

        // Build the EIP712Domain type array from the domain fields
        const eip712DomainFields: TypedDataField[] = [];
        if (modifiedDomain.name !== undefined) eip712DomainFields.push({ name: "name", type: "string" });
        if (modifiedDomain.version !== undefined) eip712DomainFields.push({ name: "version", type: "string" });
        if (modifiedDomain.chainId !== undefined) eip712DomainFields.push({ name: "chainId", type: "uint256" });
        if (modifiedDomain.verifyingContract !== undefined) eip712DomainFields.push({ name: "verifyingContract", type: "address" });
        if (modifiedDomain.salt !== undefined) eip712DomainFields.push({ name: "salt", type: "bytes32" });

        // Determine primaryType (first key in types that isn't EIP712Domain)
        const primaryType = Object.keys(types).find(k => k !== "EIP712Domain") ?? Object.keys(types)[0];

        // Construct the full EIP-712 JSON structure
        const eip712Json = {
            types: {
                EIP712Domain: eip712DomainFields,
                ...types,
            },
            domain: modifiedDomain,
            primaryType,
            message: value,
        };

        // Hex-encode the JSON (handle BigInt values)
        const jsonStr = JSON.stringify(eip712Json, (_key, val) =>
            typeof val === 'bigint' ? val.toString() : val
        );
        const rawData = '0x' + Buffer.from(jsonStr, 'utf-8').toString('hex');

        // Build the Fordefi API payload
        const chain = `evm_${this.config.chainId}`;
        const requestJson = buildTypedMessagePayload(this.config.vaultId, rawData, chain);
        const requestBody = JSON.stringify(requestJson);

        // Sign the API request with the PEM private key
        const timestamp = new Date().getTime();
        const payload = `${this.config.pathEndpoint}|${timestamp}|${requestBody}`;
        const apiSignature = await signWithApiUserPrivateKey(this.config.privateKeyPath, payload);

        // POST to Fordefi API
        console.log("Sending EIP-712 signing request to Fordefi API...");
        const response = await createAndSignTx(
            this.config.pathEndpoint,
            this.config.accessToken,
            apiSignature,
            timestamp,
            requestBody,
        );

        // Handle timeout / waiting-for-approval
        if (response.data.has_timed_out && response.data.state === "waiting_for_approval") {
            const txId = response.data.id;
            throw new Error(
                `Signing request timed out while waiting for approval. ` +
                `Transaction ID: ${txId}. Track status: GET /api/v1/transactions/${txId}`
            );
        }

        // Extract the signature from the response
        if (!response.data.signatures || response.data.signatures.length === 0) {
            throw new Error(`No signatures returned from Fordefi API. Response state: ${response.data.state}`);
        }

        const signatureB64 = response.data.signatures[0];
        const signatureBytes = Buffer.from(signatureB64, 'base64');
        const signatureHex = '0x' + signatureBytes.toString('hex');

        console.log("Signature received:", signatureHex);
        return signatureHex;
    }
}
