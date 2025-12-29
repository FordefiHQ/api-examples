export interface NearTransferConfig {
    originVault: string;
    originAddress: string;
    destinationAddress: string;
    amount: bigint; // Amount in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR)
    accessToken: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
}

export interface FordefiNearConfig {
    accessToken: string;
    originVault: string;
    originAddress: string; // NEAR address (implicit hex or named account)
    privateKeyPem: string;
    apiPathEndpoint: string; 
    transferAmount: number; // Amount in NEAR to transfer
    stakeAmount: number; // Amount in NEAR to stake
    stakingPoolId: string; // Staking pool contract (e.g., "pool.near" suffix)
}

export interface NearStakingConfig {
    originVault: string;
    originAddress: string;
    stakingPoolId: string; // e.g., "figment.poolv1.near"
    amount: bigint; // Amount in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR)
    accessToken: string;
    privateKeyPem: string;
    apiPathEndpoint: string;
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
