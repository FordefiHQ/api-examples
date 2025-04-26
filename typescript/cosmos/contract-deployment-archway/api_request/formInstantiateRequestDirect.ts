import { FordefiConfig } from '../src/config';
import { encodeTxBody } from './encodeTxBody'
import { MsgInstantiateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { getAuthInfo } from './getAuthInfo';

export async function createInstantiateRequest(fordefiConfig: FordefiConfig, code_id: number, label: string, msgString: string) {  
  const feeAmount = (fordefiConfig.gasPrice * fordefiConfig.gasLimit).toString();

  // 1. Create the MsgInstantiateContract message
  const instantiateContractMsg = MsgInstantiateContract.fromPartial({
    sender: fordefiConfig.senderAddress,
    admin: "", // Empty string means no admin
    codeId: BigInt(code_id),
    label: label,
    msg: new TextEncoder().encode(msgString),
    funds: []
  });

  // 2. Create and encode the transaction body
  const typeUrl = "/cosmwasm.wasm.v1.MsgInstantiateContract"
  const value = MsgInstantiateContract.encode(instantiateContractMsg).finish()
  const bodyBase64 = await encodeTxBody(typeUrl, value)
  
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