import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { FordefiConfig } from '../src/config'; 
import { TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { getAuthInfo } from './getAuthInfo';

export async function createStoreRequest(fordefiConfig: FordefiConfig, binary: Uint8Array) {
  const feeAmount = (fordefiConfig.gasPrice * fordefiConfig.gasLimit).toString();

  // 1. Create the MsgStoreCode message
  const storeCodeMsg = MsgStoreCode.fromPartial({
     sender: fordefiConfig.senderAddress,
     wasmByteCode: binary,
     instantiatePermission: undefined
  });
  
  // 2. Create and encode the transaction body
  const txBody = TxBody.fromPartial({
    messages: [{
      typeUrl: "/cosmwasm.wasm.v1.MsgStoreCode",
      value: MsgStoreCode.encode(storeCodeMsg).finish()
    }],
    memo: ""
  });
  
  const bodyBytes = TxBody.encode(txBody).finish();
  const bodyBase64 = toBase64(bodyBytes);
  
  // 3. Create and encode the auth info
  const authInfoBase64 = await getAuthInfo(fordefiConfig, feeAmount);
  
  // 4. Construct the request with direct format
  const requestJson = {
    "vault_id": fordefiConfig.vaultId,
    "signer_type": "api_signer",
    "type": "cosmos_transaction",
    "details": {
      "type": "cosmos_raw_transaction",
      "chain": "cosmos_archway-1",
      "request_data": {
        "format": "direct",
        "body": bodyBase64,
        "auth_info": authInfoBase64
      }
    }
  };
  
  return requestJson;
}