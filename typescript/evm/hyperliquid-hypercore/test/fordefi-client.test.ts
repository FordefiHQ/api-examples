import assert from "node:assert/strict";
import test from "node:test";
import { inspect } from "node:util";
import { AxiosError, type AxiosResponse } from "axios";
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

test("transport errors never carry the API token into logs", async () => {
    const TOKEN = "super-secret-fordefi-token";

    // Reproduces what axios actually throws on a dead socket: AxiosError attaches
    // `config` (headers hold the bearer token) and `request` (raw header buffer holds
    // it again) as own enumerable properties, with no custom inspect hook to hide them.
    const authHeader = `Bearer ${TOKEN}`;
    const axiosFailure = new AxiosError(
        "connect ECONNREFUSED 127.0.0.1:1",
        "ECONNREFUSED",
        { headers: { Authorization: authHeader, "x-signature": "sig" } } as never,
        { _header: `POST /api/v1/transactions HTTP/1.1\r\nAuthorization: ${authHeader}\r\n` },
    );

    // Guard the guard: if this ever stops holding, the redaction below is testing nothing.
    assert.ok(
        inspect(axiosFailure, { depth: 8 }).includes(TOKEN),
        "expected a raw AxiosError to expose the token — the hazard this test defends against",
    );

    const http = {
        get: async () => { throw axiosFailure; },
        post: async () => { throw axiosFailure; },
    } as unknown as FordefiHttpClient;
    const client = new FordefiApiClient(TOKEN, "unused.pem", http, async () => {}, "https://example.test", async () => "signature");

    for (const call of [
        () => client.createTransaction("/api/v1/transactions", { vault_id: "v" }),
        () => client.getTransaction("tx1"),
    ]) {
        const thrown = await call().then(() => null, (error: unknown) => error);
        assert.ok(thrown instanceof Error, "expected an Error");

        // Deep inspection is what console.error, structured loggers, and error
        // reporters all end up doing to a thrown error.
        const rendered = `${inspect(thrown, { depth: 10 })}${thrown.stack ?? ""}${JSON.stringify(thrown)}`;
        assert.ok(!rendered.includes(TOKEN), "API token leaked into the serialized error");
        assert.ok(!rendered.includes("Authorization"), "Authorization header leaked into the serialized error");

        // Still useful for debugging.
        assert.match(thrown.message, /ECONNREFUSED/);
    }
});

test("non-transport errors keep their original message", async () => {
    // assertSuccessful throws inside the same try block; redaction must not swallow it.
    const http = {
        get: async () => ({ data: { detail: "nope" }, status: 403, statusText: "Forbidden", headers: {}, config: { headers: {} } }),
        post: async () => ({ data: { detail: "nope" }, status: 403, statusText: "Forbidden", headers: {}, config: { headers: {} } }),
    } as unknown as FordefiHttpClient;
    const client = new FordefiApiClient("token", "unused.pem", http, async () => {}, "https://example.test", async () => "signature");

    await assert.rejects(client.getTransaction("tx1"), /Fordefi API returned HTTP 403/);
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
