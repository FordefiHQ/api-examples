import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { OrderParameters } from "@nktkas/hyperliquid";
import { buildAgentName, generateAgentKeypair } from "../src/agent-key";
import { formatPerpsOrder } from "../src/order-utils";
import { executeHyperliquidAction } from "../src/hyperliquid-client";
import { SignatureOnlyError } from "../src/wallet-adapter";

const order: OrderParameters = {
    orders: [{ a: 0, b: true, p: "", s: "0.0123456", r: false, t: { limit: { tif: "Gtc" } } }],
};

test("order formatting follows SDK precision rules without mutating input", () => {
    const original = structuredClone(order);
    const high = formatPerpsOrder(order, "97123.456789", 5);
    assert.equal(high.orders[0]?.p, "97123");
    assert.equal(high.orders[0]?.s, "0.01234");
    assert.deepEqual(order, original);

    const low = formatPerpsOrder(order, "0.012345678", 2);
    assert.equal(low.orders[0]?.p, "0.0123");
});

test("manual signature mode is a successful explicit result and other failures propagate", async () => {
    assert.deepEqual(
        await executeHyperliquidAction(async () => { throw new SignatureOnlyError("0xabc"); }),
        { signature: "0xabc", broadcast: false },
    );
    await assert.rejects(
        executeHyperliquidAction(async () => { throw new Error("network failed"); }),
        /network failed/,
    );
});

test("agent key files are owner-only and cannot be overwritten", () => {
    const directory = mkdtempSync(join(tmpdir(), "hyperliquid-agent-"));
    const path = join(directory, "agent.json");
    try {
        const address = generateAgentKeypair("smith", path);
        assert.match(address, /^0x[0-9A-Fa-f]{40}$/);
        assert.equal(statSync(path).mode & 0o777, 0o600);
        assert.match(readFileSync(path, "utf8"), /private_key_smith/);
        assert.throws(() => generateAgentKeypair("smith", path), /EEXIST/);
        assert.equal(buildAgentName("smith"), "smith");
        assert.equal(buildAgentName("smith", "1774777045175"), "smith valid_until 1774777045175");
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
