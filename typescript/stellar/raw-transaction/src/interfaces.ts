export interface PaymentConfig {
  vaultAddress: string;
  destination: string;
  amount: string;
  horizonUrl: string;
}

export interface TokenPaymentConfig extends PaymentConfig {
  assetCode: string;
  assetIssuer: string;
}

