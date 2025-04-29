import { TxBody } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { toBase64 } from '@cosmjs/encoding';

export async function encodeTxBody(typeUrl: string, messageValue: Uint8Array): Promise<string> {
    const txBody = TxBody.fromPartial({
        messages: [{
          typeUrl: typeUrl,
          value: messageValue
        }],
        memo: ""
      });
      
    const bodyBytes = TxBody.encode(txBody).finish();
    const bodyBase64 = toBase64(bodyBytes);
    return bodyBase64;
}