// api-examples/typescript/cosmos/contract-deployment-archway/api_request/createAuthInfo.ts
import { toBase64, fromBase64 } from '@cosmjs/encoding';
import { getSequence } from "./getSequence";
import { FordefiConfig } from '../src/config';
import { AuthInfo } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';

export async function getAuthInfo(fordefiConfig: FordefiConfig, feeAmount: string): Promise<string> {
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
  return toBase64(authInfoBytes);
}