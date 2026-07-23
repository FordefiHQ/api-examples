import * as ethers from "ethers";
import { ClobClient, Side, SignatureTypeV2 } from "@polymarket/clob-client-v2";
import { fordefiConfig } from "./config";
import { getProvider } from "./get-provider";
import { getRecentMarket } from "./get-market";
import { getPolymarketClient } from "./get-polymarket-client";
import { getRelayClient } from "./get-relay-client";

// High-frequency mode: orders are funded by the Polymarket deposit wallet and
// signed by the Fordefi vault as EIP-712 messages (ERC-7739-wrapped for the
// deposit wallet's ERC-1271 validation — the client handles the wrapping).
// Nothing here touches the chain — placing an order costs one Fordefi message
// signature, no gas, no broadcast. Run `npm run setup` once before this.

async function placeOrder(client: ClobClient, tokenID: string, price: number, size: number) {
    const start = Date.now();
    const response = await client.createAndPostOrder({
        tokenID,
        price,
        size,
        side: Side.BUY,
    });
    if (!response?.success || !response.orderID) {
        throw new Error(`Order rejected by CLOB: ${JSON.stringify(response)}`);
    }
    console.log(`Order placed in ${Date.now() - start}ms — ID: ${response.orderID}`);
    return response;
}

async function main(){
    const provider = await getProvider(fordefiConfig);
    const web3Provider = new ethers.providers.Web3Provider(provider);
    const signer = web3Provider.getSigner();

    const depositWallet = await getRelayClient(signer).deriveDepositWalletAddress();
    console.log(`Orders funded by deposit wallet: ${depositWallet}`);

    const polymarketClient = await getPolymarketClient(
        signer,
        fordefiConfig,
        SignatureTypeV2.POLY_1271,
        depositWallet
    );

    const market = await getRecentMarket(polymarketClient);
    if (!market.accepting_orders) {
        console.log("Market is closed and not accepting orders");
        return;
    }
    console.log(`Market: ${market.question ?? market.condition_id}`);

    const yesToken = market.tokens.find((t: any) => t.outcome === "Yes");
    if (!yesToken) {
        throw new Error("Yes outcome not found");
    }

    // Buy Yes with a limit order at the current price, sized to just clear
    // Polymarket's $1 minimum order value. placeOrder() is deliberately
    // self-contained — in a real high-frequency strategy this is the only
    // call in your hot loop.
    const size = Math.ceil(105 / (yesToken.price * 100)); // ≥ $1.05 of value
    await placeOrder(polymarketClient, yesToken.token_id, yesToken.price, size);
}
main().catch(console.error);
