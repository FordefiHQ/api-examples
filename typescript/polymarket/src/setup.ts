import * as ethers from "ethers";
import { AssetType, getContractConfig, SignatureTypeV2 } from "@polymarket/clob-client-v2";
import { DepositWalletCall, RelayerTransactionState } from "@polymarket/builder-relayer-client";
import { fordefiConfig } from "./config";
import { getProvider } from "./get-provider";
import { getRelayClient } from "./get-relay-client";
import { getPolymarketClient } from "./get-polymarket-client";

// One-time gasless setup. New Polymarket API accounts
// must trade through a "deposit wallet" (an ERC-1967 proxy owned by the vault):
// the relayer deploys it and executes its approvals gaslessly — the Fordefi
// vault only ever signs EIP-712 messages, it never broadcasts a transaction.

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
];
const ERC1155_ABI = [
    "function setApprovalForAll(address operator, bool approved)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
];

const DONE_STATES = [RelayerTransactionState.STATE_MINED, RelayerTransactionState.STATE_CONFIRMED];

async function main(){
    const provider = await getProvider(fordefiConfig);
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const signer = web3Provider.getSigner();
    const relayClient = getRelayClient(signer);

    const depositWallet = await relayClient.deriveDepositWalletAddress();
    console.log(`Polymarket deposit wallet owned by vault ${fordefiConfig.address}: ${depositWallet}`);

    // 1. Deploy the deposit wallet if it doesn't exist yet
    const deployed = await relayClient.getDeployed(depositWallet, "WALLET");
    if (deployed) {
        console.log("Deposit wallet already deployed ✓");
    } else {
        console.log("Deposit wallet not deployed — deploying via relayer (gasless)...");
        const resp = await relayClient.deployDepositWallet();
        console.log(`Relayer accepted deployment: ${resp.transactionID} (${resp.state})`);
        const txn = await relayClient.pollUntilState(resp.transactionID, DONE_STATES, RelayerTransactionState.STATE_FAILED, 30);
        if (!txn) {
            throw new Error("Deposit wallet deployment failed or timed out");
        }
        console.log(`Deposit wallet deployed: ${txn.transactionHash}`);
    }

    // 2. Approve the exchanges to move the deposit wallet's pUSD and outcome tokens
    const contracts = getContractConfig(fordefiConfig.chainId as number);
    const pusd = new ethers.Contract(contracts.collateral, ERC20_ABI, web3Provider);
    const ctf = new ethers.Contract(contracts.conditionalTokens, ERC1155_ABI, web3Provider);

    // Only the current-generation contracts — the relayer whitelists approval
    // targets and rejects the legacy V1 exchanges for deposit wallets. The V3
    // exchange is whitelisted as a pUSD spender but not as a CTF operator.
    const erc20Spenders = [contracts.conditionalTokens, contracts.exchangeV2, contracts.exchangeV3,
                           contracts.negRiskExchangeV2, contracts.negRiskAdapter];
    const exchanges = [contracts.exchangeV2, contracts.negRiskExchangeV2, contracts.negRiskAdapter];

    const calls: DepositWalletCall[] = [];
    for (const spender of erc20Spenders) {
        const allowance: ethers.BigNumber = await pusd.allowance(depositWallet, spender);
        if (allowance.isZero()) {
            calls.push({
                target: contracts.collateral,
                value: "0",
                data: pusd.interface.encodeFunctionData("approve", [spender, ethers.constants.MaxUint256]),
            });
        }
    }
    for (const operator of exchanges) {
        const approved: boolean = await ctf.isApprovedForAll(depositWallet, operator);
        if (!approved) {
            calls.push({
                target: contracts.conditionalTokens,
                value: "0",
                data: ctf.interface.encodeFunctionData("setApprovalForAll", [operator, true]),
            });
        }
    }

    if (calls.length === 0) {
        console.log("All approvals already set ✓");
    } else {
        console.log(`Submitting ${calls.length} approval(s) as one gasless deposit-wallet batch...`);
        const deadline = `${Math.floor(Date.now() / 1000) + 600}`;
        const resp = await relayClient.executeDepositWalletBatch(calls, depositWallet, deadline);
        console.log(`Relayer accepted approvals: ${resp.transactionID} (${resp.state})`);
        const txn = await relayClient.pollUntilState(resp.transactionID, DONE_STATES, RelayerTransactionState.STATE_FAILED, 30);
        if (!txn) {
            throw new Error("Approval batch failed or timed out");
        }
        console.log(`Approvals mined: ${txn.transactionHash}`);
    }

    // 3. Tell the CLOB to refresh its view of the deposit wallet's balance/allowances
    const clobClient = await getPolymarketClient(signer, fordefiConfig, SignatureTypeV2.POLY_1271, depositWallet);
    await clobClient.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    console.log("CLOB balance/allowance synced ✓");

    console.log(`\nSetup complete. Fund the deposit wallet with pUSD (${contracts.collateral})`);
    console.log(`by sending to ${depositWallet}, then place orders with: npm run bet`);
}
main().catch(console.error);
