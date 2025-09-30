import { ethers, TypedDataDomain, TypedDataField } from 'ethers';
import { fordefiConfig } from './config';

/**
 * Custom wallet adapter for Fordefi integration with Hyperliquid
 *
 * IMPORTANT LIMITATIONS:
 * - Fordefi wallets CAN sign User-Signed Actions (like usdSend, withdraw) which use the actual network chainId
 * - Fordefi wallets CANNOT sign L1 Actions (like vaultTransfer) which require chainId 1337
 *
 * WHY THIS LIMITATION EXISTS:
 * - Hyperliquid L1 actions use EIP-712 signatures with chainId 1337 in the domain
 * - ChainId 1337 is not a real blockchain network - it's a placeholder value used by Hyperliquid
 * - Fordefi's signing infrastructure requires the chainId to correspond to an actual network
 * - Attempting to sign with chainId 1337 will result in signature recovery errors
 *
 * SOLUTION FOR L1 ACTIONS:
 * - Use API/Agent wallets instead (see hl-vault-transfer-agent.ts)
 * - Agent wallets are standard Ethereum private keys that can sign with arbitrary chainIds
 * - The agent wallet must be approved by the master account first using the approveAgent action
 * - Agent wallets sign on behalf of the master account for L1 actions
 *
 * SUPPORTED ACTIONS WITH FORDEFI:
 * ✅ usdSend (User-Signed Action - uses Arbitrum chainId)
 * ✅ withdraw3 (User-Signed Action - uses Arbitrum chainId)
 * ✅ deposit (Ethereum L1 transaction)
 * ❌ vaultTransfer (L1 Action - requires chainId 1337 - use agent wallet)
 * ❌ Other L1 Actions (require chainId 1337 - use agent wallet)
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

    // Return Arbitrum chainId so the library knows what chain the wallet is on
    async getChainId(): Promise<string> {
        return typeof fordefiConfig.chainId === 'number'
            ? String(fordefiConfig.chainId)
            : fordefiConfig.chainId;
    }

    /**
     * Sign EIP-712 typed data
     *
     * Hyperliquid uses two different signing schemes:
     *
     * 1. L1 Actions (e.g., vaultTransfer, approveAgent):
     *    - Use EIP-712 domain with chainId 1337
     *    - Domain name: "Exchange"
     *    - Type: "Agent"
     *    - ❌ NOT SUPPORTED by Fordefi - use agent wallets instead
     *
     * 2. User-Signed Actions (e.g., usdSend, withdraw3):
     *    - Use EIP-712 domain with the actual network chainId (e.g., 42161 for Arbitrum)
     *    - Domain name: "HyperliquidTransaction" (or specific action name)
     *    - Various types depending on action
     *    - ✅ SUPPORTED by Fordefi
     *
     * This method detects L1 actions and throws an error to prevent incorrect signatures.
     */
    async signTypedData(
        domain: TypedDataDomain,
        types: Record<string, Array<TypedDataField>>,
        value: Record<string, any>
    ): Promise<string> {
        console.log("Signing with domain:", JSON.stringify(domain, null, 2));
        console.log("Types:", JSON.stringify(types, null, 2));
        console.log("Value:", JSON.stringify(value, null, 2));

        // Detect L1 actions which are NOT supported by Fordefi
        const isL1Action = domain.name === "Exchange" && domain.chainId === 1337;

        if (isL1Action) {
            console.error("❌ ERROR: L1 Action detected with chainId 1337");
            console.error("Fordefi wallets cannot sign L1 actions because chainId 1337 is not a real network.");
            console.error("SOLUTION: Use an API/Agent wallet instead (see hl-vault-transfer-agent.ts)");
            throw new Error(
                "L1 Actions with chainId 1337 are not supported by Fordefi. " +
                "Use an API/Agent wallet instead. See hl-vault-transfer-agent.ts for the correct implementation."
            );
        }

        // For User-Signed Actions, override with Arbitrum chainId
        const modifiedDomain = {
            ...domain,
            chainId: fordefiConfig.chainId
        };
        console.log("✅ User-signed action detected - using chainId:", fordefiConfig.chainId);
        return this.signer.signTypedData(modifiedDomain, types, value);
    }
}