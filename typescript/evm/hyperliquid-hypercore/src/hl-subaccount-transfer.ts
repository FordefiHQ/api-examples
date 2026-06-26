import { HyperliquidConfig, SubAccountTransferConfig, TransferMarket } from './interfaces'
import { fordefiConfig } from './config'
import * as hl from "@nktkas/hyperliquid";
import { FordefiWalletAdapter, findSignatureOnlyError } from './wallet-adapter';

/**
 * Execute a single master↔sub transfer leg.
 *
 * The Fordefi vault is always the signer (the master account), so every leg is expressed
 * relative to it: `subAccountUser` names the sub-account, and `isDeposit` sets the direction
 * (true = master → sub, false = sub → master).
 */
async function transferLeg(
    exchClient: hl.ExchangeClient,
    market: TransferMarket,
    subAccountUser: `0x${string}`,
    isDeposit: boolean,
    amount: string,
    token?: string,
) {
    if (market === "spot") {
        // Spot amount is passed as-is (standard units, not scaled), token is required
        return await exchClient.subAccountSpotTransfer({
            subAccountUser,
            isDeposit,
            token: token!,
            amount: String(amount),
        });
    }
    // Perps USDC amount expressed as integer micro-USD (float * 1e6)
    const usd = Math.round(parseFloat(String(amount)) * 1e6);
    return await exchClient.subAccountTransfer({
        subAccountUser,
        isDeposit,
        usd,
    });
}

export async function subAccountTransferRouter(hyperliquidConfig: HyperliquidConfig) {
    if (!hyperliquidConfig) {
        throw new Error("Config required!");
    }

    const transfer: SubAccountTransferConfig | undefined = hyperliquidConfig.transfer;
    if (!transfer) {
        throw new Error("`transfer` config is required for the subAccountTransfer action");
    }

    const { market, from, to, amount, token } = transfer;

    // ---- Validation -------------------------------------------------------
    if (!amount) {
        throw new Error("transfer.amount is required and cannot be empty");
    }
    if (market !== "spot" && market !== "perps") {
        throw new Error('transfer.market must be "spot" or "perps"');
    }
    if (market === "spot" && !token) {
        throw new Error('transfer.token is required for a Spot transfer (format: "TOKEN:address")');
    }

    const masterAddress = fordefiConfig.address.toLowerCase();
    const isMaster = (ref: string) => ref === "master" || ref.toLowerCase() === masterAddress;
    const isSubAddress = (ref: string) => ref !== "master" && ref.startsWith("0x");

    if (!isMaster(from) && !isSubAddress(from)) {
        throw new Error('transfer.from must be "master" or a sub-account address starting with "0x"');
    }
    if (!isMaster(to) && !isSubAddress(to)) {
        throw new Error('transfer.to must be "master" or a sub-account address starting with "0x"');
    }

    const fromMaster = isMaster(from);
    const toMaster = isMaster(to);

    if (fromMaster && toMaster) {
        throw new Error("transfer.from and transfer.to cannot both be the master account");
    }
    if (!fromMaster && !toMaster) {
        throw new Error(
            "Direct sub-account → sub-account transfers are not supported by Hyperliquid: " +
            "exactly one of transfer.from / transfer.to must be \"master\". " +
            "To move between two sub-accounts, run two transfers (sub → master, then master → sub)."
        );
    }

    try {
        const wallet = new FordefiWalletAdapter(fordefiConfig);

        const transport = new hl.HttpTransport({
            isTestnet: hyperliquidConfig.isTestnet
        });

        const exchClient = new hl.ExchangeClient({
            wallet,
            transport,
            signatureChainId: '0x539'
        });
        console.log("Exchange client created successfully");

        const marketLabel = market === "spot" ? `${token} (Spot)` : `${amount} USDC (Perps)`;

        if (fromMaster) {
            // master → sub (deposit into the sub-account)
            const subAccountUser = (to as `0x${string}`).toLowerCase() as `0x${string}`;
            const result = await transferLeg(exchClient, market, subAccountUser, true, amount, token);
            console.log(`Successfully transferred ${marketLabel} Master → Subaccount (${subAccountUser}):`, result);
            return result;
        }

        // sub → master (withdraw from the sub-account)
        const subAccountUser = (from as `0x${string}`).toLowerCase() as `0x${string}`;
        const result = await transferLeg(exchClient, market, subAccountUser, false, amount, token);
        console.log(`Successfully transferred ${marketLabel} Subaccount (${subAccountUser}) → Master:`, result);
        return result;

    } catch (error: any) {
        const sigOnly = findSignatureOnlyError(error);
        if (sigOnly) {
            console.log("Signature obtained (not broadcast):", sigOnly.signature);
            return { signature: sigOnly.signature };
        }
        console.error("Error during subaccount transfer:", error.message || String(error));
        if (error.cause) {
            console.error("Cause:", error.cause);
        }
    };
};
