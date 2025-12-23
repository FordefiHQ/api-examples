import { fordefiConfig, txParams, contractAbi } from "./config.js";
import { createAndSignTx, pollForTxHash } from "./push-to-api.js";
import { signWithApiUserPrivateKey } from "./signer.js";
import { createRequest } from "./build-tx-payload.js";
import { encodeCallData } from "./encode-call-data.js";
import { ethers } from "ethers";

async function main(): Promise<void> {
  // Check .env variables are set
  if (!fordefiConfig.accessToken || !fordefiConfig.vaultId || !fordefiConfig.senderAddress) {
    console.error('Error: Missing required configuration:');
    if (!fordefiConfig.accessToken) console.error('- FORDEFI_API_USER_TOKEN environment variable is not set');
    if (!fordefiConfig.vaultId) console.error('- VAULT_ID environment variable is not set');
    if (!fordefiConfig.senderAddress) console.error('- VAULT_ADDRESS environment variable is not set');
    return;
  };

  try {
    // 1. Encode calldata
    const hexCallData = encodeCallData(contractAbi, "inc");

    // 2. Create json payload for transaction
    const requestBody = JSON.stringify(await createRequest(fordefiConfig, txParams, hexCallData));

    // 3. Sign payload with API User private key
    const timestamp = new Date().getTime();
    const payload = `${fordefiConfig.pathEndpoint}|${timestamp}|${requestBody}`;
    const signature = await signWithApiUserPrivateKey(fordefiConfig.privateKeyPath, payload);

    // 4. Submit the signed payload to Fordefi for tx creation and MPC signature
    const response = await createAndSignTx(fordefiConfig.pathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
    const fordefiTxId = response.data.id;
    console.log("Fordefi transaction ID:", fordefiTxId);

    // 5. Poll Fordefi API for the transaction hash
    const txHash = await pollForTxHash(fordefiTxId, fordefiConfig.accessToken);
    console.log("Transaction hash:", txHash);

    // 6. Track transaction on local Hardhat node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    console.log("Waiting for transaction confirmation on Hardhat...");
    const receipt = await provider.waitForTransaction(txHash);

    if (receipt && receipt.status === 1) {
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());
    } else {
      console.error("Transaction failed or reverted");
    }

  } catch (error: any) {
    console.error(`Failed: ${error.message}`);
  };
};
  
main();