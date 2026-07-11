import { Contract, Interface, JsonRpcProvider, Signature, formatUnits, parseUnits } from "ethers";
import { fordefiConfig } from "./config";
import type { DepositActionConfig } from "./interfaces";
import { FordefiWalletAdapter } from "./wallet-adapter";
import { buildEvmTransactionPayload } from "./api_request/buildPayload";
import { FordefiApiClient } from "./api_request/fordefi-client";

const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HYPERLIQUID_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const;

export async function deposit(config: DepositActionConfig) {
    const usdcAddress = config.usdcAddress ?? ARBITRUM_USDC;
    const bridgeAddress = config.bridgeAddress ?? HYPERLIQUID_BRIDGE;
    const provider = new JsonRpcProvider(fordefiConfig.rpcUrl);
    const usdc = new Contract(usdcAddress, ["function nonces(address owner) view returns (uint256)"], provider);
    const nonce = await usdc.getFunction("nonces").staticCall(fordefiConfig.address) as bigint;
    const value = parseUnits(config.amount, 6);
    const deadline = Math.floor(Date.now() / 1000) + 3_600;

    const permitWallet = new FordefiWalletAdapter({
        ...fordefiConfig,
        chainId: 42161,
        pushMode: "auto",
    });
    const rawSignature = await permitWallet.signTypedData(
        { name: "USD Coin", version: "2", chainId: 42161, verifyingContract: usdcAddress },
        {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        {
            owner: fordefiConfig.address,
            spender: bridgeAddress,
            value: value.toString(),
            nonce: nonce.toString(),
            deadline: deadline.toString(),
        },
    );
    const signature = Signature.from(rawSignature);
    const bridge = new Interface([
        "function batchedDepositWithPermit(tuple(address user, uint64 usd, uint64 deadline, tuple(uint256 r, uint256 s, uint8 v) signature)[] deposits)",
    ]);
    const calldata = bridge.encodeFunctionData("batchedDepositWithPermit", [[{
        user: fordefiConfig.address,
        usd: value,
        deadline,
        signature: { r: signature.r, s: signature.s, v: signature.v },
    }]]);
    const payload = buildEvmTransactionPayload(
        fordefiConfig.vaultId,
        "arbitrum_mainnet",
        bridgeAddress,
        calldata,
        "0",
        "auto",
    );

    console.log(`Depositing ${formatUnits(value, 6)} USDC to Hyperliquid...`);
    const client = new FordefiApiClient(fordefiConfig.accessToken, fordefiConfig.privateKeyPath);
    const created = await client.createTransaction("/api/v1/transactions", payload);
    const completed = await client.waitForTerminal(created);
    console.log(`Deposit confirmed. Hash: ${completed.hash ?? "N/A"}`);
    return {
        transactionId: completed.id,
        transactionHash: completed.hash,
        state: completed.state,
        amount: formatUnits(value, 6),
        user: fordefiConfig.address,
    };
}
