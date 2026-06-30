export type TransferMarket = "spot" | "perps";
export type AccountRef = "master" | `0x${string}`;   // "master" = the Fordefi vault
export type Action = "deposit" | "withdraw" | "sendUsd" | "vault_transfer" | "approve_agent" | "revoke_agent" | "spotTransfer" | "subAccountTransfer" | "placeOrder"

/**
 * Structured config for the "subAccountTransfer" action.
 *
 * The Fordefi vault is always the signer (the master account). A `from`/`to` pair
 * — each either the literal "master" or a sub-account address — expresses the transfer,
 * and the router picks the right SDK call:
 *   - master → sub : isDeposit: true
 *   - sub → master : isDeposit: false
 *
 * Exactly one of `from`/`to` must be "master" (Hyperliquid has no native sub→sub call;
 * move between two sub-accounts with two transfers: sub → master, then master → sub).
 */
export interface SubAccountTransferConfig {
    market: TransferMarket;
    from: AccountRef;      // "master" or a sub-account address owned by the vault
    to: AccountRef;        // "master" or a sub-account address owned by the vault
    amount: string;
    token?: string;        // required when market === "spot" (format "TOKEN:address")
}

export interface HyperliquidConfig {
    action: Action
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    token?: string,               // Required for "spotTransfer" (format: "TOKEN:address")
    isDeposit?: boolean,          // Required for "vault_transfer" action
    subAccountDeposit?: boolean,  // Deprecated for "subAccountTransfer" (use `transfer` instead)
    hyperliquid_vault_address?: string
    toSpot?: boolean              // "spotTransfer": true = Perps→Spot, false = Spot→Perps
    usdcAddress?: string,         // Arbitrum USDC contract address (deposit action)
    bridgeAddress?: string,       // Hyperliquid bridge contract address (deposit action)
    transfer?: SubAccountTransferConfig,  // Required for "subAccountTransfer" action
}

export interface AgentWalletConfig {
    agentAddress: string,
    agentName: string,
    validUntil?: string // only required for a "approve_agent" action, MAX is 180 days in UNIX time
}

export interface FordefiApiConfig {
    vaultId: string;
    address: string;
    accessToken: string;
    privateKeyPath: string;
    pathEndpoint: string;
    rpcUrl: string;
    chainId: number;
    pushMode: "auto" | "manual";
}