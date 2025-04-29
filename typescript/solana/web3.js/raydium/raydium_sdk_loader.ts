import { Raydium } from '@raydium-io/raydium-sdk-v2'
import { Connection, PublicKey } from '@solana/web3.js'

let raydium: Raydium | undefined
export const initSdk = async (vault: PublicKey, connection: Connection, params?: { loadToken?: boolean } ) => {
  if (raydium) return raydium
  console.log(`Connected to public RPC ${connection.rpcEndpoint} on mainnet`)
  raydium = await Raydium.load({
    owner: vault as PublicKey,
    connection,
    cluster: 'mainnet',
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  })
  
  return raydium;
}
