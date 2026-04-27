export interface PChainTransferConfig {
    originVault: string;
    originAddress: string;
    destinationAddress: string;
    amount: bigint; // Amount in nAVAX (1 AVAX = 1e9 nAVAX)
    accessToken: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
}

export interface FordefiPChainConfig {
    accessToken: string;
    originVault: string;
    originAddress: string; // P-Chain address in format P-avax1... or hex
    nodeId: string; // NodeID to delegate to (NodeID-...)
    privateKeyPem: string;
    apiPathEndpoint: string;
    stakeAmount: bigint; // Amount in nAVAX (1 AVAX = 1e9 nAVAX)
    transferAmount: number;
    startTime: bigint; // Unix timestamp when delegation starts
    endTime: bigint; // Unix timestamp when delegation ends
    rewardAddress?: string; // Optional, defaults to originAddress
}

export interface FordefiTransactionResponse {
  id: string;
  state: string;
  signatures: Array<{
    data: string;
    signed_by: any;
  }>;
  details: {
    type: string;
    signature?: any;
    hash_binary: string;
  };
}