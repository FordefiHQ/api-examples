import { 
    Rpc, 
    RpcSubscriptions, 
    SolanaRpcApi, 
    SolanaRpcSubscriptionsApi, 
    createSolanaRpc, 
    createSolanaRpcSubscriptions } from '@solana/kit';
import { fordefiConfig } from '../config'; 

export type Client = {
    rpc: Rpc<SolanaRpcApi>;
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
};

let client: Client | undefined;
export function createClient(): Client {
    if (!client) {
        client = {
            rpc: createSolanaRpc(fordefiConfig.rpc),
            rpcSubscriptions: createSolanaRpcSubscriptions(fordefiConfig.ws),
        };
    }
    return client;
}