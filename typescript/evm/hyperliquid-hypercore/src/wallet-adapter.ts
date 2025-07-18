import { ethers, TypedDataDomain, TypedDataField } from 'ethers';
import { fordefiConfig } from './config';

// Custom wallet adapter for Fordefi integration with HyperCore
export class FordefiWalletAdapter {
    private signer: ethers.Signer;
    private address: string;

    constructor(signer: ethers.Signer, address: string) {
        this.signer = signer;
        this.address = address;
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

        const modifiedDomain = {
            ...domain,
            chainId: fordefiConfig.chainId
        };
        console.log("Modified domain:", modifiedDomain);
        
        return this.signer.signTypedData(
            modifiedDomain,
            types,
            value
        );
    }
} 