import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { getSequence } from "./getSequence";
import { FordefiConfig } from '../src/config';
import { TxBody, AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { MsgInstantiateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';

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
  const txBody = TxBody.fromPartial({
    messages: [{
      typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
      value: MsgInstantiateContract.encode(instantiateContractMsg).finish()
    }],
    memo: ""
  });
  
  const bodyBytes = TxBody.encode(txBody).finish();
  const bodyBase64 = toBase64(bodyBytes);
  
  // 3. Create and encode the auth info
  const publicKeyBytes = fromBase64(fordefiConfig.compressedPubKey);
  const pubKey = PubKey.fromPartial({
    key: publicKeyBytes
  });

  const nextSequence = await getSequence(fordefiConfig.senderAddress);
  console.log(`Next sequence: ${nextSequence}`);
  
  const authInfo = AuthInfo.fromPartial({
    signerInfos: [{
      publicKey: {
        typeUrl: "/cosmos.crypto.secp256k1.PubKey",
        value: PubKey.encode(pubKey).finish()
      },
      modeInfo: {
        single: {
          mode: SignMode.SIGN_MODE_DIRECT
        }
      },
      sequence: BigInt(nextSequence)
    }],
    fee: {
      amount: [{
        denom: "aarch",
        amount: feeAmount
      }],
      gasLimit: BigInt(fordefiConfig.gasLimit)
    }
  });
  
  const authInfoBytes = AuthInfo.encode(authInfo).finish();
  const authInfoBase64 = toBase64(authInfoBytes);
  
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