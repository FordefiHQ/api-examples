import { ethers, TypedDataDomain, TypedDataField } from 'ethers';
import { fordefiConfig } from './config';

// Custom wallet adapter for Fordefi integration with HyperCore
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

    // Return Arbitrum chainId so the library knows what chain the wallet is on
    async getChainId(): Promise<string> {
        return typeof fordefiConfig.chainId === 'number'
            ? String(fordefiConfig.chainId)
            : fordefiConfig.chainId;
    }

    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        console.log("Signing with domain:", JSON.stringify(domain, null, 2));
        console.log("Types:", JSON.stringify(types, null, 2));
        console.log("Value:", JSON.stringify(value, null, 2));

        // IMPORTANT: Hyperliquid uses different chainIds for different action types:
        // - L1 actions (vault transfers): require chainId 1337 (Exchange domain)
        // - User-signed actions: use the actual network chainId

        // For L1 actions (Exchange domain with chainId 1337), we need to sign with Arbitrum chainId
        // but the EIP-712 domain should keep 1337
        const isL1Action = domain.name === "Exchange" && domain.chainId === 1337;

        if (isL1Action) {
            console.log("Detected L1 action - keeping chainId 1337 for EIP-712 domain");
            // Keep domain as-is for L1 actions
            return this.signer.signTypedData(domain, types, value);
        } else {
            // For user-signed actions, override with Arbitrum chainId
            const modifiedDomain = {
                ...domain,
                chainId: fordefiConfig.chainId
            };
            console.log("User-signed action - using chainId:", fordefiConfig.chainId);
            return this.signer.signTypedData(modifiedDomain, types, value);
        }
    }
} 