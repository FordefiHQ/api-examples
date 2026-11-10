import { createSolanaRpc, Rpc, SolanaRpcApi } from '@solana/kit';
import { fordefiConfig } from '../src/config';

let client: Rpc<SolanaRpcApi> | undefined;
export function createClient(): Rpc<SolanaRpcApi> {
    if (!client) {
        client = createSolanaRpc(fordefiConfig.rpcUrl);
    }
    return client;
}
