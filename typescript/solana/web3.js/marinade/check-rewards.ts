import { NativeStakingConfig, NativeStakingSDK } from '@marinade.finance/native-staking-sdk'
import { PublicKey, Connection } from '@solana/web3.js'
import { fordefiConfig } from './config'

const connection = new Connection("https://api.mainnet-beta.solana.com")
const config = new NativeStakingConfig({ connection: connection})
const sdk = new NativeStakingSDK(config)

async function checkStatusMarinade(){
    const publicKey  = new PublicKey (fordefiConfig.fordefiSolanaVaultAddress); // from @solana/wallet-adapter-react
    const myStakeAccounts = await sdk.getStakeAccounts(publicKey); // fetches stake accounts ready to be revoked, stake acccount that are being prepared to be revoked, stake accounts that Marinade manages
    console.log("My stake accounts: ", myStakeAccounts.staking)

    const myRewards = await sdk.fetchRewards(publicKey); // fetches rewards of user's stake accounts in the Marinade Native Staking (note: apy will be `null` if there are no active stake accounts yet)
    console.log("My rewards: ", myRewards.data_points)
}
if (require.main === module) {
    checkStatusMarinade();
  }
