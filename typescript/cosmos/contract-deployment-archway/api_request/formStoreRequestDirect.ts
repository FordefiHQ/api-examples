import { FordefiConfig } from '../src/config';
import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { getAuthInfo } from './getAuthInfo';
import { encodeTxBody } from './encodeTxBody'

export async function createStoreRequest(fordefiConfig: FordefiConfig, binary: Uint8Array) {
  const feeAmount = (fordefiConfig.gasPrice * fordefiConfig.gasLimit).toString();

  // 1. Create the MsgStoreCode message
  const storeCodeMsg = MsgStoreCode.fromPartial({
     sender: fordefiConfig.senderAddress,
     wasmByteCode: binary,
     instantiatePermission: undefined
  });
  
  // 2. Create and encode the transaction body
  const typeUrl = "/cosmwasm.wasm.v1.MsgStoreCode";
  const value = MsgStoreCode.encode(storeCodeMsg).finish();
  const bodyBase64 = await encodeTxBody(typeUrl, value);
  
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