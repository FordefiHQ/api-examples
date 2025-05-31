export interface AminoSignDoc {
    account_number: string;
    chain_id: string;
    fee: {
      amount: Array<{
        amount: string;
        denom: string;
      }>;
      gas: string;
    };
    memo: string;
    msgs: Array<{
      type: string;
      value: {
        amount: Array<{
          amount: string;
          denom: string;
        }>;
        from_address: string;
        to_address: string;
      }
    }>;
    sequence: string;
}

export interface TransferConfig {
    amountToTransfer: string;  
    destination: string;       
    gasLimit: number;         
    gasPrice: string;         
}