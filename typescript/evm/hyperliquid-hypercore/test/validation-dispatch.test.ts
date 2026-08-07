import assert from "node:assert/strict";
import test from "node:test";
import { getAddress } from "ethers";
import { dispatchAction, type ActionHandlers } from "../src/dispatcher";
import { ACTIONS, type HyperliquidConfig, type ValidatedActionConfig } from "../src/interfaces";
import {
    parseAction,
    parseBooleanEnv,
    parsePositiveUnits,
    parseUsdMicros,
    validateAddress,
    validateActionConfig,
    validateDestination,
} from "../src/validation";

const master = "0x1111111111111111111111111111111111111111" as const;
const recipient = "0x2222222222222222222222222222222222222222" as const;
const subAccount = "0x3333333333333333333333333333333333333333" as const;

test("parseAction accepts supported actions and rejects missing or unknown values", () => {
    for (const action of ACTIONS) assert.equal(parseAction(action), action);
    assert.throws(() => parseAction(undefined), /ACTION must be one of/);
    assert.throws(() => parseAction("typo"), /Received: typo/);
});

test("amount and address validators reject malformed inputs and preserve integer precision", () => {
    assert.equal(parseUsdMicros("1.234567"), 1_234_567);
    assert.equal(parsePositiveUnits("0.000001", 6, "amount"), 1n);
    assert.throws(() => parseUsdMicros("1.2345678"), /at most 6/);
    assert.throws(() => parseUsdMicros("5abc"), /positive decimal string/);
    assert.throws(() => parseUsdMicros("0"), /greater than zero/);
    assert.throws(() => validateAddress("0x1234", "destination"), /valid EVM address/);
});

test("HYPERLIQUID_TESTNET defaults to testnet and refuses to guess at a typo", () => {
    // An unconfigured run must not touch mainnet.
    assert.equal(parseBooleanEnv(undefined, true, "HYPERLIQUID_TESTNET"), true);
    assert.equal(parseBooleanEnv("", true, "HYPERLIQUID_TESTNET"), true);
    assert.equal(parseBooleanEnv("  ", true, "HYPERLIQUID_TESTNET"), true);

    assert.equal(parseBooleanEnv("false", true, "HYPERLIQUID_TESTNET"), false);
    assert.equal(parseBooleanEnv("FALSE", true, "HYPERLIQUID_TESTNET"), false);
    assert.equal(parseBooleanEnv(" True ", false, "HYPERLIQUID_TESTNET"), true);

    // The dangerous case: a typo must throw rather than fall back to the default,
    // because falling back the wrong way here moves real funds.
    for (const typo of ["flase", "0", "1", "no", "yes", "mainnet"]) {
        assert.throws(
            () => parseBooleanEnv(typo, true, "HYPERLIQUID_TESTNET"),
            /must be "true" or "false"/,
            `expected "${typo}" to be rejected`,
        );
    }
});

test("irreversible destinations require a checksum and reject the zero address", () => {
    const checksummed = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";
    assert.equal(validateDestination(checksummed), checksummed);

    // Addresses with no letters carry no checksum information at all, so they stay allowed.
    assert.equal(validateDestination(recipient), recipient);

    // An address whose correct EIP-55 checksum happens to be all lowercase must not be
    // falsely rejected — sniffing letter case instead of comparing to the canonical
    // form would lock the user out of a perfectly valid destination.
    const lowercaseChecksum = "0x727610f309922b66878979510183e232d5b77500";
    assert.equal(getAddress(lowercaseChecksum), lowercaseChecksum, "fixture must be its own checksum");
    assert.equal(validateDestination(lowercaseChecksum), lowercaseChecksum);

    // All-uppercase defeats EIP-55 exactly as all-lowercase does.
    assert.throws(() => validateDestination(`0x${checksummed.slice(2).toUpperCase()}`), /must be EIP-55 checksummed/);

    // Lowercased-but-not-caseless input silently defeats EIP-55, which is exactly the
    // typo class that loses funds on an irreversible withdraw3.
    assert.throws(() => validateDestination(checksummed.toLowerCase()), /must be EIP-55 checksummed/);

    // A single flipped character in an otherwise checksummed address must not pass.
    assert.throws(() => validateDestination(`0xAb5801a7D398351b8bE11C439e05C5B3259aeC9C`), /valid EVM address/);

    assert.throws(
        () => validateAddress("0x0000000000000000000000000000000000000000", "destination"),
        /must not be the zero address/,
    );
});

test("action validation enforces network and action-specific fields", () => {
    assert.throws(
        () => validateActionConfig({ action: "deposit", isTestnet: true, amount: "5" }, master),
        /mainnet-only/,
    );
    assert.throws(
        () => validateActionConfig({ action: "deposit", isTestnet: false, amount: "4.999999" }, master),
        /at least 5 USDC/,
    );
    assert.throws(
        () => validateActionConfig({ action: "withdraw", isTestnet: true, amount: "1" }, master),
        /destination is required/,
    );
    assert.throws(
        () => validateActionConfig({
            action: "subAccountTransfer",
            isTestnet: true,
            transfer: { market: "perps", from: "master", to: "master", amount: "1" },
        }, master),
        /exactly one/,
    );
});

test("dispatcher routes every supported action and validates before calling handlers", async () => {
    const seen: string[] = [];
    const handle = async (config: ValidatedActionConfig) => { seen.push(config.action); };
    const handlers: ActionHandlers = {
        deposit: handle,
        withdraw: handle,
        sendUsd: handle,
        vault_transfer: handle,
        approve_agent: handle,
        revoke_agent: handle,
        spotTransfer: handle,
        subAccountTransfer: handle,
        placeOrder: handle,
    };
    const configs: HyperliquidConfig[] = [
        { action: "deposit", isTestnet: false, amount: "5" },
        { action: "withdraw", isTestnet: true, amount: "1", destination: recipient },
        { action: "sendUsd", isTestnet: true, amount: "1", destination: recipient },
        { action: "vault_transfer", isTestnet: true, amount: "1", isDeposit: true, hyperliquidVaultAddress: recipient },
        { action: "approve_agent", isTestnet: true },
        { action: "revoke_agent", isTestnet: true },
        { action: "spotTransfer", isTestnet: true, amount: "1", token: "USDC:0x1234", toSpot: true },
        {
            action: "subAccountTransfer",
            isTestnet: true,
            transfer: { market: "perps", from: "master", to: subAccount, amount: "1" },
        },
        { action: "placeOrder", isTestnet: true },
    ];
    for (const config of configs) await dispatchAction(config, master, handlers);
    assert.deepEqual(seen, [...ACTIONS]);

    await assert.rejects(
        dispatchAction({ action: "withdraw", isTestnet: true, amount: "1" }, master, handlers),
        /destination is required/,
    );
    await assert.rejects(
        dispatchAction({ action: "unknown", isTestnet: true } as unknown as HyperliquidConfig, master, handlers),
        /Unsupported action: unknown/,
    );
    assert.deepEqual(seen, [...ACTIONS]);
});
