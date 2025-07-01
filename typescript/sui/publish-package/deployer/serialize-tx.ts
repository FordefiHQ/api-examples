import { Transaction } from "@mysten/sui/transactions";
import { signWithApiSigner } from "./api_utils/signer";
import { createRequest } from "./api_utils/form_request";
import { createAndSignTx } from "./api_utils/pushToApi";
import { SuiClient } from '@mysten/sui/client';

export async function submitTransactionToFordefi(
    client: SuiClient,
    tx: Transaction,
    vault_id: string,
    accessToken: string
  ) {
    const bcsData = await tx.build({ client });
    const base64TxData = Buffer.from(bcsData).toString("base64");
  
    const requestBody = JSON.stringify(await createRequest(vault_id, base64TxData));
    const pathEndpoint = "/api/v1/transactions/create-and-wait";
    const timestamp = new Date().getTime();
    const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiSigner(payload);
  
    const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody);
    return response.data;
  }