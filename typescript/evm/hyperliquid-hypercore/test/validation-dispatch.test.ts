import assert from "node:assert/strict";
import test from "node:test";
import { dispatchAction, type ActionHandlers } from "../src/dispatcher";
import { ACTIONS, type HyperliquidConfig, type ValidatedActionConfig } from "../src/interfaces";
import { parseAction, parsePositiveUnits, parseUsdMicros, validateAddress, validateActionConfig } from "../src/validation";

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
