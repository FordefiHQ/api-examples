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

export interface HyperliquidConfig {
    action: string
    isTestnet: boolean,
    destination?: `0x${string}`,
    amount?: string,
    token?: string,               // Required for "spotTransfer" and Spot "subAccountTransfer" (format: "TOKEN:address")
    isDeposit?: boolean,          // Required for "vault_transfer" action
    subAccountDeposit?: boolean,  // Required for "subAccountTransfer": true = main → subaccount, false = subaccount → main
    hyperliquid_vault_address?: string
    toSpot?: boolean              // "spotTransfer": true = Perps→Spot, false = Spot→Perps. "subAccountTransfer": true = Spot balance, false = Perps balance
    usdcAddress?: string,         // Arbitrum USDC contract address (deposit action)
    bridgeAddress?: string,       // Hyperliquid bridge contract address (deposit action)
}

export interface AgentWalletConfig {
    agentAddress: string,
    agentName: string,
    validUntil?: string // only required for a "approve_agent" action, MAX is 180 days in UNIX time
}