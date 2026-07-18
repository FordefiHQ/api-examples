export interface PaymentConfig {
  vaultAddress: string;
  destination: string;
  amount: string;
  horizonUrl: string;
}

export interface TokenPaymentConfig extends PaymentConfig {
  assetCode: string;
  assetIssuer: string;
  // Optional Stellar MEMO_ID — a uint64 as a decimal string (e.g. an exchange
  // deposit id). Omitted when unset.
  memoId?: string;
}

