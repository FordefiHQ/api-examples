export const ACTIONS = [
    "deposit",
    "withdraw",
    "sendUsd",
    "vault_transfer",
    "approve_agent",
    "revoke_agent",
    "spotTransfer",
    "subAccountTransfer",
    "placeOrder",
] as const;

export type Action = typeof ACTIONS[number];
export type TransferMarket = "spot" | "perps";
export type AccountRef = "master" | `0x${string}`;
export type EvmAddress = `0x${string}`;

export interface SubAccountTransferConfig {
    market: TransferMarket;
    from: AccountRef;
    to: AccountRef;
    amount: string;
    token?: string;
}

/** Editable input config. Required action fields are checked before dispatch. */
export interface HyperliquidConfig {
    action: Action;
    isTestnet: boolean;
    destination?: EvmAddress;
    amount?: string;
    token?: string;
    isDeposit?: boolean;
    hyperliquidVaultAddress?: EvmAddress;
    toSpot?: boolean;
    usdcAddress?: EvmAddress;
    bridgeAddress?: EvmAddress;
    transfer?: SubAccountTransferConfig;
}

interface ActionConfigBase<A extends Action> {
    action: A;
    isTestnet: boolean;
}

export interface DepositActionConfig extends ActionConfigBase<"deposit"> {
    amount: string;
    usdcAddress?: EvmAddress;
    bridgeAddress?: EvmAddress;
}

export interface AddressAmountActionConfig<A extends "withdraw" | "sendUsd"> extends ActionConfigBase<A> {
    destination: EvmAddress;
    amount: string;
}

export interface VaultTransferActionConfig extends ActionConfigBase<"vault_transfer"> {
    hyperliquidVaultAddress: EvmAddress;
    amount: string;
    isDeposit: boolean;
}

export interface SpotTransferActionConfig extends ActionConfigBase<"spotTransfer"> {
    amount: string;
    token: string;
    toSpot: boolean;
}

export interface SubAccountTransferActionConfig extends ActionConfigBase<"subAccountTransfer"> {
    transfer: SubAccountTransferConfig;
}

export interface SimpleActionConfig<A extends "approve_agent" | "revoke_agent" | "placeOrder"> extends ActionConfigBase<A> {}

export type ValidatedActionConfig =
    | DepositActionConfig
    | AddressAmountActionConfig<"withdraw">
    | AddressAmountActionConfig<"sendUsd">
    | VaultTransferActionConfig
    | SpotTransferActionConfig
    | SubAccountTransferActionConfig
    | SimpleActionConfig<"approve_agent">
    | SimpleActionConfig<"revoke_agent">
    | SimpleActionConfig<"placeOrder">;

export interface AgentWalletConfig {
    agentAddress?: EvmAddress;
    agentName: string;
    validUntil?: string;
    privateKeyOutputPath?: string;
}

export interface FordefiApiConfig {
    vaultId: string;
    address: EvmAddress;
    accessToken: string;
    privateKeyPath: string;
    pathEndpoint: string;
    rpcUrl: string;
    chainId: number;
    pushMode: "auto" | "manual";
}

export interface SignatureOnlyResult {
    signature: string;
    broadcast: false;
}
