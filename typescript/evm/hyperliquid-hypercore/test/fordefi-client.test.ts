import assert from "node:assert/strict";
import test from "node:test";
import type { AxiosResponse } from "axios";
import {
    FordefiApiClient,
    type FordefiHttpClient,
    type FordefiTransaction,
} from "../src/api_request/fordefi-client";

function response<T>(data: T, status = 200): AxiosResponse<T> {
    return { data, status, statusText: "OK", headers: {}, config: { headers: {} } } as AxiosResponse<T>;
}

function clientWithGetSequence(sequence: FordefiTransaction[]) {
    let getCalls = 0;
    const http = {
        get: async <T>() => {
            const item = sequence[getCalls++];
            if (!item) throw new Error("Unexpected GET");
            return response(item) as AxiosResponse<T>;
        },
        post: async <T>() => response({} as T),
    } satisfies FordefiHttpClient;
    const client = new FordefiApiClient("token", "unused.pem", http, async () => {}, "https://example.test", async () => "signature");
    return { client, getCalls: () => getCalls };
}

test("waitForSignature handles immediate and delayed signatures", async () => {
    const immediate = clientWithGetSequence([]);
    assert.equal(await immediate.client.waitForSignature({ id: "tx1", state: "signed", signatures: ["abc"] }), "abc");
    assert.equal(immediate.getCalls(), 0);

    const delayed = clientWithGetSequence([
        { id: "tx2", state: "approved" },
        { id: "tx2", state: "signed", signatures: ["def"] },
    ]);
    assert.equal(await delayed.client.waitForSignature({ id: "tx2", state: "pending" }, { maxAttempts: 2, intervalMs: 0 }), "def");
    assert.equal(delayed.getCalls(), 2);
});

test("waitForSignature reports approval timeout, failure, and exhausted attempts", async () => {
    const empty = clientWithGetSequence([]).client;
    await assert.rejects(
        empty.waitForSignature({ id: "approval", state: "waiting_for_approval", has_timed_out: true }),
        /timed out while waiting for approval/,
    );
    await assert.rejects(empty.waitForSignature({ id: "failed", state: "rejected" }), /failed with state: rejected/);

    const exhausted = clientWithGetSequence([{ id: "pending", state: "approved" }]).client;
    await assert.rejects(
        exhausted.waitForSignature({ id: "pending", state: "pending" }, { maxAttempts: 1, intervalMs: 0 }),
        /No signature.*after 1 polls/,
    );
});

test("waitForTerminal returns success and rejects failed transactions", async () => {
    const successful = clientWithGetSequence([{ id: "tx", state: "completed", hash: "0xabc" }]).client;
    assert.equal(
        (await successful.waitForTerminal({ id: "tx", state: "pending" }, { maxAttempts: 1, intervalMs: 0 })).hash,
        "0xabc",
    );
    const failed = clientWithGetSequence([]).client;
    await assert.rejects(failed.waitForTerminal({ id: "tx", state: "failed" }), /failed with state: failed/);
});
