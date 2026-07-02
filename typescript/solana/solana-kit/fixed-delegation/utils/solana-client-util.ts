import { fordefiConfig } from "../src/config";
import { Rpc, RpcSubscriptions, SolanaRpcApi, SolanaRpcSubscriptionsApi, createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
 
export type Client = {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

let client: Client | undefined;
export function createClient(): Client {
    if (!client) {
        client = {
            rpc: createSolanaRpc(fordefiConfig.mainnetRpc),
            rpcSubscriptions: createSolanaRpcSubscriptions(fordefiConfig.ws),
        };
    }
    return client;
}