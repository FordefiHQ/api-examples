export interface FordefiConfig {
  accessToken: string;
  vaultId: string;
  vaultAddress: string;
  privateKeyPath: string;
  pathEndpoint: string;
  baseApiUrl: string
}

export interface BinConfig {
  amount: number;
  binId: number;
  minXAmount: number;
  minYAmount: number;
}

export interface ContractCallParams {
  contractAddress: string;
  contractName: string;
  functionName: string;
  poolTraitAddress: string;
  poolTraitName: string;
  xTokenAddress: string;
  xTokenName: string;
  yTokenAddress: string;
  yTokenName: string;
  bins: BinConfig[];
  fee: string;
  note: string;
}