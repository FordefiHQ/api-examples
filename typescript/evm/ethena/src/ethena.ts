import { createPublicClient, Hex, http } from "viem";
import "dotenv/config";
import {
  approve,
  bigIntAmount,
  createMintOrder,
  getAllowance,
  getRfq,
  submitOrder,
  UINT256_MAX,
} from "./mint_utils";
import {
  SignatureType,
  Signature,
} from "./types";
import { ETHENA_MINTING_ABI } from "./minting_abi";
import { mainnet } from "viem/chains";
import { fordefiConfig, mintOrder } from './config'
import { getProvider } from './get-provider';
import {
  DOMAIN,
  RPC_URL,
  MINT_ADDRESS,
  ORDER_TYPE,
} from "./constants";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});
const ALLOW_INFINITE_APPROVALS = false;

async function main() {
  try {
    const provider = await getProvider();
    if (!provider) {
        throw new Error("Failed to initialize provider");
    }
    const signer = provider.getSigner();

    const collateralAssetAddress = mintOrder.collateralAddresses[mintOrder.collateralAsset]

    // Get RFQ
    const pair = `${mintOrder.collateralAsset}/USDe`;
    const rfqData = await getRfq(pair, "ALGO", mintOrder.side, mintOrder.amount, mintOrder.benefactor);

    console.log("RFQ", rfqData);

    // Create order
    const order = await createMintOrder(
      rfqData,
      mintOrder.benefactor,
      mintOrder.benefactor, // Using same address for beneficiary
      collateralAssetAddress
    );

    console.log("Order", order);

    // Get allowance
    const allowance = await getAllowance(collateralAssetAddress, fordefiConfig.address);
    console.log("Allowance", allowance);

    // Determine if approval required
    if (allowance < bigIntAmount(mintOrder.amount)) {
      // Approving
      let txHash: Hex;

      // Reset allowance for USDT before approving
      if (mintOrder.collateralAsset === "USDT" && allowance > 0) {
        const revokeTxHash = await approve(
          collateralAssetAddress,
          signer,
          bigIntAmount(0)
        );
        await publicClient.waitForTransactionReceipt({
          hash: revokeTxHash,
          confirmations: 1,
        });
        console.log(
          `Revoke submitted: https://etherscan.io/tx/${revokeTxHash}`
        );
      }

      txHash = await approve(
        collateralAssetAddress,
        signer,
        ALLOW_INFINITE_APPROVALS ? UINT256_MAX : bigIntAmount(mintOrder.amount)
      );
      console.log(`Approval submitted: https://etherscan.io/tx/${txHash}`);

      // Wait for the transaction to be mined
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
    }

    const orderForSigning = {
      ...order,
      order_type: order.order_type === 'MINT' ? 0 : 1,
      expiry: BigInt(order.expiry),
      nonce: BigInt(order.nonce),
      collateral_amount: BigInt(order.collateral_amount),
      usde_amount: BigInt(order.usde_amount)
    };

    // Sign the properly formatted order
    const signature = await signer._signTypedData(
      DOMAIN,
      JSON.parse(JSON.stringify(ORDER_TYPE)),
      orderForSigning
    );

    console.log("Signature", signature);

    const isValidSignature = await publicClient.readContract({
      address: MINT_ADDRESS,
      abi: ETHENA_MINTING_ABI,
      functionName: "verifyOrder",
      args: [
        orderForSigning,
        {
          signature_type: Number(SignatureType.EIP712),
          signature_bytes: signature.startsWith('0x') ? signature as `0x${string}` : `0x${signature}`,
        },
      ],
    });

    console.log("isValidSignature", isValidSignature);

    const signatureObj: Signature = {
      signature_type: SignatureType.EIP712,
      signature_bytes: signature.startsWith('0x') ? signature as `0x${string}` : `0x${signature}`,
    };

    // Submit order
    const txHash = await submitOrder(order, signatureObj);
    console.log(`Transaction submitted: https://etherscan.io/tx/${txHash}`);
  } catch (error) {
    console.error(error);
  }
}

main();