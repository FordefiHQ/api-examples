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

    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        console.log("Signing with domain:", domain);
        console.log("Types:", types);
        console.log("Value:", value);

        // IMPORTANT: Hyperliquid uses different chainIds for different action types:
        // - L1 actions (vault transfers): require chainId 1337
        // - User-signed actions (usdSend): use the actual network chainId
        const modifiedDomain = domain.chainId === 1337
            ? domain  // Keep 1337 for L1 actions (Exchange domain)
            : {
                ...domain,
                chainId: fordefiConfig.chainId  // Override for user-signed actions
            };
        console.log("Modified domain:", modifiedDomain);

        return this.signer.signTypedData(
            modifiedDomain,
            types,
            value
        );
    }
} 