import { getAddress, parseUnits } from "ethers";
import {
    ACTIONS,
    type Action,
    type EvmAddress,
    type HyperliquidConfig,
    type SubAccountTransferConfig,
    type ValidatedActionConfig,
} from "./interfaces";

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const TOKEN_PATTERN = /^[^:\s]+:0x[0-9a-fA-F]+$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function parseAction(value: string | undefined): Action {
    if (value && (ACTIONS as readonly string[]).includes(value)) return value as Action;
    throw new Error(`ACTION must be one of: ${ACTIONS.join(", ")}. Received: ${value ?? "<unset>"}`);
}

/**
 * Strict boolean env parsing.
 *
 * Deliberately throws on anything that is not exactly "true"/"false" rather than
 * falling back to the default. A typo such as HYPERLIQUID_TESTNET=flase must not
 * silently resolve to mainnet and move real funds.
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean, field: string): boolean {
    if (value === undefined || value.trim() === "") return defaultValue;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new Error(`${field} must be "true" or "false". Received: ${value}`);
}

export function validateAddress(value: string | undefined, field: string): EvmAddress {
    if (!value) throw new Error(`${field} is required`);
    let address: EvmAddress;
    try {
        address = getAddress(value) as EvmAddress;
    } catch {
        throw new Error(`${field} must be a valid EVM address`);
    }
    if (address === ZERO_ADDRESS) throw new Error(`${field} must not be the zero address`);
    return address;
}

/**
 * Destination validation for irreversible transfers (withdraw3, usdSend).
 *
 * ethers' getAddress only verifies the EIP-55 checksum when the input is mixed
 * case, so an all-lowercase address carries no typo protection at all. For funds
 * that cannot be recovered we require a checksummed address, which makes a
 * mistyped character fail here instead of on-chain.
 */
export function validateDestination(value: string | undefined, field = "destination"): EvmAddress {
    const address = validateAddress(value, field);
    const raw = value!.trim();
    const withPrefix = /^0[xX]/.test(raw) ? `0x${raw.slice(2)}` : `0x${raw}`;
    // Require the exact canonical form. Comparing against getAddress' output rather
    // than sniffing letter case also accepts the two cases that carry no checksum
    // information of their own: addresses with no letters, and addresses whose correct
    // checksum happens to be all lowercase.
    if (withPrefix !== address) {
        throw new Error(
            `${field} must be EIP-55 checksummed for irreversible transfers. ` +
            `Use ${address} instead of ${raw}.`,
        );
    }
    return address;
}

export function parsePositiveUnits(value: string | undefined, decimals: number, field: string): bigint {
    if (!value || !DECIMAL_PATTERN.test(value)) {
        throw new Error(`${field} must be a positive decimal string`);
    }
    let units: bigint;
    try {
        units = parseUnits(value, decimals);
    } catch {
        throw new Error(`${field} must have at most ${decimals} decimal places`);
    }
    if (units <= 0n) throw new Error(`${field} must be greater than zero`);
    return units;
}

export function parseUsdMicros(value: string | undefined, field = "amount"): number {
    const units = parsePositiveUnits(value, 6, field);
    if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} is too large`);
    return Number(units);
}

export function validateToken(value: string | undefined, field = "token"): string {
    if (!value || !TOKEN_PATTERN.test(value)) {
        throw new Error(`${field} must use the TOKEN:0xHEX format`);
    }
    return value;
}

export function validateSubAccountTransfer(
    transfer: SubAccountTransferConfig | undefined,
    masterAddress: EvmAddress,
): SubAccountTransferConfig {
    if (!transfer) throw new Error("transfer config is required for subAccountTransfer");
    parsePositiveUnits(transfer.amount, transfer.market === "perps" ? 6 : 18, "transfer.amount");
    if (transfer.market !== "spot" && transfer.market !== "perps") {
        throw new Error('transfer.market must be "spot" or "perps"');
    }
    if (transfer.market === "spot") validateToken(transfer.token, "transfer.token");

    const master = masterAddress.toLowerCase();
    const normalizeRef = (ref: string | undefined, field: string) => {
        if (ref === "master" || (typeof ref === "string" && ref.toLowerCase() === master)) return "master" as const;
        return validateAddress(ref, field);
    };
    const from = normalizeRef(transfer.from, "transfer.from");
    const to = normalizeRef(transfer.to, "transfer.to");
    if ((from === "master") === (to === "master")) {
        throw new Error('exactly one of transfer.from and transfer.to must be "master"');
    }
    return { ...transfer, from, to, token: transfer.market === "spot" ? validateToken(transfer.token, "transfer.token") : undefined };
}

export function validateActionConfig(config: HyperliquidConfig, masterAddress: EvmAddress): ValidatedActionConfig {
    const base = { action: config.action, isTestnet: config.isTestnet };
    switch (config.action) {
        case "deposit": {
            if (config.isTestnet) throw new Error("deposit is mainnet-only; use the Hyperliquid testnet faucet instead");
            const units = parsePositiveUnits(config.amount, 6, "amount");
            if (units < 5_000_000n) throw new Error("deposit amount must be at least 5 USDC");
            return {
                ...base,
                action: "deposit",
                amount: config.amount!,
                usdcAddress: config.usdcAddress ? validateAddress(config.usdcAddress, "usdcAddress") : undefined,
                bridgeAddress: config.bridgeAddress ? validateAddress(config.bridgeAddress, "bridgeAddress") : undefined,
            };
        }
        case "withdraw":
        case "sendUsd":
            parsePositiveUnits(config.amount, 6, "amount");
            return { ...base, action: config.action, amount: config.amount!, destination: validateDestination(config.destination) };
        case "vault_transfer":
            parseUsdMicros(config.amount);
            if (typeof config.isDeposit !== "boolean") throw new Error("isDeposit is required for vault_transfer");
            return {
                ...base,
                action: "vault_transfer",
                amount: config.amount!,
                isDeposit: config.isDeposit,
                hyperliquidVaultAddress: validateAddress(config.hyperliquidVaultAddress, "hyperliquidVaultAddress"),
            };
        case "spotTransfer":
            parsePositiveUnits(config.amount, 18, "amount");
            return { ...base, action: "spotTransfer", amount: config.amount!, token: validateToken(config.token), toSpot: config.toSpot ?? true };
        case "subAccountTransfer":
            return { ...base, action: "subAccountTransfer", transfer: validateSubAccountTransfer(config.transfer, masterAddress) };
        case "approve_agent":
        case "revoke_agent":
        case "placeOrder":
            return { ...base, action: config.action };
        default:
            throw new Error(`Unsupported action: ${String(config.action)}`);
    }
}
