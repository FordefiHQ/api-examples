import { fordefiConfig } from "../config";
import { Rpc, RpcSubscriptions, SolanaRpcApi, SolanaRpcSubscriptionsApi, createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
 
export type Client = {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

let client: Client | undefined;
export function createClient(): Client {
    if (!client) {
        client = {
            rpc: createSolanaRpc(fordefiConfig.rpcUrl),
            rpcSubscriptions: createSolanaRpcSubscriptions(fordefiConfig.wsUrl),
        };
    }
    return client;
}