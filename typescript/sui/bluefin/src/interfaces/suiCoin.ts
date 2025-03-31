export interface SuiCoin {
    coinType: string;             // The type of the coin (e.g., '0x2::sui::SUI')
    coinObjectId: string;         // The unique identifier of the coin object
    version: string;              // Version number as string
    digest: string;               // Transaction digest
    balance: string;              // Coin balance as string (since these can be large numbers)
    previousTransaction: string;  // Previous transaction identifier
}