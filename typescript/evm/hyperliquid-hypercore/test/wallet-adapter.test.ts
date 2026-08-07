import assert from "node:assert/strict";
import test from "node:test";
import type { AxiosResponse } from "axios";
import { FordefiApiClient, type FordefiHttpClient } from "../src/api_request/fordefi-client";
import { FordefiWalletAdapter } from "../src/wallet-adapter";
import type { FordefiApiConfig } from "../src/interfaces";

const baseConfig: FordefiApiConfig = {
    vaultId: "vault-1",
    address: "0x1111111111111111111111111111111111111111",
    accessToken: "token",
    privateKeyPath: "unused.pem",
    pathEndpoint: "/api/v1/transactions/create-and-wait",
    rpcUrl: "https://example.test",
    chainId: 1337,
    pushMode: "auto",
};

/** Captures the payload the adapter posts, so we can assert on the exact signed bytes. */
function adapterWithCapture(config: FordefiApiConfig) {
    const posted: unknown[] = [];
    const http = {
        get: async <T>() => ({ data: {} as T, status: 200 } as AxiosResponse<T>),
        post: async <T>(_url: string, body?: unknown) => {
            posted.push(JSON.parse(body as string));
            return { data: { id: "tx1", state: "signed", signatures: ["YWJj"] }, status: 200 } as AxiosResponse<T>;
        },
    } as unknown as FordefiHttpClient;
    const apiClient = new FordefiApiClient(
        config.accessToken, config.privateKeyPath, http, async () => {}, "https://example.test", async () => "signature",
    );
    return { adapter: new FordefiWalletAdapter(config, apiClient), posted };
}

const TYPES = { Permit: [{ name: "owner", type: "address" }] };
const VALUE = { owner: baseConfig.address };

test("the adapter refuses to sign a payload whose chainId it would have to rewrite", async () => {
    const { adapter, posted } = adapterWithCapture(baseConfig);

    // The caller asks for Arbitrum while the signer is configured for the Hyperliquid
    // L1 chain. Silently rewriting this produces a signature the exchange attributes
    // to a different address, so it must fail loudly instead.
    await assert.rejects(
        adapter.signTypedData(
            { name: "USD Coin", version: "2", chainId: 42161, verifyingContract: baseConfig.address },
            TYPES,
            VALUE,
        ),
        /chainId mismatch/,
    );
    assert.equal(posted.length, 0, "nothing should reach the signing API on a mismatch");
});

test("a matching or absent chainId still signs, and the payload is unchanged", async () => {
    const matching = adapterWithCapture(baseConfig);
    const signature = await matching.adapter.signTypedData(
        { name: "Exchange", version: "1", chainId: 1337, verifyingContract: baseConfig.address },
        TYPES,
        VALUE,
    );
    assert.equal(signature, "0x616263");

    const payload = matching.posted[0] as { details: { raw_data: string; chain: string } };
    assert.equal(payload.details.chain, "evm_1337");

    const decoded = JSON.parse(Buffer.from(payload.details.raw_data.slice(2), "hex").toString("utf8"));
    assert.equal(decoded.domain.chainId, 1337);
    assert.equal(decoded.primaryType, "Permit");
    assert.deepEqual(
        decoded.types.EIP712Domain.map((f: { name: string }) => f.name),
        ["name", "version", "chainId", "verifyingContract"],
    );

    // A caller that supplies no chainId still gets the configured one filled in.
    const absent = adapterWithCapture(baseConfig);
    await absent.adapter.signTypedData({ name: "Exchange", version: "1" }, TYPES, VALUE);
    const filled = absent.posted[0] as { details: { raw_data: string } };
    assert.equal(
        JSON.parse(Buffer.from(filled.details.raw_data.slice(2), "hex").toString("utf8")).domain.chainId,
        1337,
    );
});

test("the deposit permit path signs on Arbitrum when the signer is configured for it", async () => {
    // hl-deposit builds a dedicated adapter at chainId 42161; that must still work.
    const { adapter, posted } = adapterWithCapture({ ...baseConfig, chainId: 42161 });
    await adapter.signTypedData(
        { name: "USD Coin", version: "2", chainId: 42161, verifyingContract: baseConfig.address },
        TYPES,
        VALUE,
    );
    const payload = posted[0] as { details: { chain: string } };
    assert.equal(payload.details.chain, "evm_42161");
});
