import { Raydium } from '@raydium-io/raydium-sdk-v2'
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js'

const cluster = 'mainnet'

let raydium: Raydium | undefined
export const initSdk = async (vault: PublicKey, connection: Connection, params?: { loadToken?: boolean } ) => {
  if (raydium) return raydium
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
  raydium = await Raydium.load({
    owner: vault as PublicKey,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  })
  return raydium
}
