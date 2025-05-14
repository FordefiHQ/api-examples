import "dotenv/config";
import {
  Address,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  Hex,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import {
  OrderSending,
  OrderSigning,
  Rfq,
  SignatureType,
  Signature,
} from "./types";
import {
  DOMAIN,
  ETHENA_URL,
  RPC_URL,
  MINT_ADDRESS,
  ORDER_TYPE,
} from "./constants";

export async function getRfq(
  pair: string,
  type: string,
  side: "MINT" | "REDEEM",
  size: number,
  benefactor: Address
) {
  const response = await fetch(
    `${ETHENA_URL}rfq?pair=${pair}&type_=${type}&side=${side}&size=${size}&benefactor=${benefactor}`
  );
  return (await response.json()) as Rfq;
}

export async function createMintOrder(
  rfqData: Rfq,
  benefactor: Address,
  beneficiary: Address,
  collateralAsset: Address
): Promise<OrderSending> {
  const expiry = Math.floor(Date.now() / 1000) + 60;

  return {
    order_id: rfqData.rfq_id,
    order_type: rfqData.side,
    expiry,
    nonce: expiry,
    benefactor,
    beneficiary,
    collateral_asset: collateralAsset,
    collateral_amount: rfqData.collateral_amount,
    usde_amount: rfqData.usde_amount,
  };
}
import { ethers } from 'ethers';

export async function signOrder(
  order: OrderSigning,
  privateKey: string
): Promise<Signature> {
  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(RPC_URL),
  });

  const account = privateKeyToAccount(privateKey as Hex);

  const signature = await walletClient.signTypedData({
    account,
    domain: DOMAIN,
    message: order,
    primaryType: "Order",
    types: ORDER_TYPE,
  });

  return {
    signature_type: SignatureType.EIP712,
    signature_bytes: signature,
  };
}

export async function getAllowance(
  collateralAddress: `0x${string}`,
  fordefiAddress: `0x${string}`
) {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(process.env.RPC_URL as string),
  });
  const allowance = await publicClient.readContract({
    address: collateralAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [fordefiAddress, MINT_ADDRESS],
  });
  return allowance;
}

export async function approve(
  collateralAddress: `0x${string}`,
  signer: ethers.providers.JsonRpcSigner,
  amount: bigint
) {
  // Use ethers.js contract interaction instead of viem's writeContract
  const erc20Contract = new ethers.Contract(
    collateralAddress,
    erc20Abi,
    signer
  );
  
  const txResponse = await erc20Contract.approve(MINT_ADDRESS, amount);
  return txResponse.hash;
}

export function bigIntAmount(amount: number) {
  return BigInt(amount) * BigInt(10 ** 6);
}

export const UINT256_MAX = BigInt(2) ** BigInt(256) - BigInt(1);

export async function submitOrder(order: OrderSending, signature: Signature) {
  const response = await fetch(
    `${ETHENA_URL}order?signature=${signature.signature_bytes}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...order,
      }),
    }
  );

  const result = await response.json();

  if ("error" in result) {
    console.error(result.error);
    throw new Error(result.error);
  }

  return result.tx;
}