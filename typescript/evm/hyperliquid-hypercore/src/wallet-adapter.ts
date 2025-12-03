import { ethers, TypedDataDomain, TypedDataField } from 'ethers';
import { fordefiConfig } from './config';

/**
 * Custom wallet adapter for Fordefi integration with Hyperliquid
 *
 * Fordefi supports signing with chainId 1337, enabling most Hyperliquid actions
 * directly from your Fordefi vault.
 *
 * CHAINID REQUIREMENTS:
 *
 * chainId 1337 - Works for ALL actions EXCEPT deposit:
 *   ✅ vault_transfer
 *   ✅ approve_agent
 *   ✅ revoke_agent
 *   ✅ withdraw
 *   ✅ sendUsd
 *   ✅ spotTransfer
 *
 * chainId 42161 - REQUIRED for deposit only:
 *   ✅ deposit (Arbitrum on-chain transaction)
 */
export class FordefiWalletAdapter {
    private signer: ethers.Signer;
    private address: string;

    constructor(signer: ethers.Signer, address: string) {
        this.signer = signer;
        this.address = address.toLowerCase()
    }

    async getAddress(): Promise<string> {
        return this.address;
    }

    // Return the configured chainId (1337 for most actions, 42161 for deposit)
    async getChainId(): Promise<string> {
        return typeof fordefiConfig.chainId === 'number'
            ? String(fordefiConfig.chainId)
            : fordefiConfig.chainId;
    }

    /**
     * Sign EIP-712 typed data
     *
     * Uses the chainId configured in fordefiConfig.
     * ChainId 1337 works for all actions except deposit (which requires 42161).
     */
    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        console.log("Signing with domain:", JSON.stringify(domain, null, 2));
        console.log("Types:", JSON.stringify(types, null, 2));
        console.log("Value:", JSON.stringify(value, null, 2));

        const modifiedDomain = {
            ...domain,
            chainId: fordefiConfig.chainId
        };
        console.log("✅ Signing with chainId:", fordefiConfig.chainId);
        return this.signer.signTypedData(modifiedDomain, types, value);
    }
}