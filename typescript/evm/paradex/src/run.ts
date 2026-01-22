
import { fordefiConfig, paradexAction } from './config.js';
import { getProvider } from './get-provider.js';
import { withdraw } from './withdraw.js';
import * as Paradex from '@paradex/sdk';
import { ethers } from 'ethers';

async function main(){
    let provider = await getProvider(fordefiConfig);
    if (!provider) throw new Error("Failed to initialize provider");
    const web3Provider = new ethers.BrowserProvider(provider);
    const signer = await web3Provider.getSigner();

    const paradexConfig = await Paradex.Config.fetch('prod');
    const paradexSigner = Paradex.Signer.fromEthers(signer);

    let paradexClient;
    try {
        paradexClient = await Paradex.Client.fromEthSigner(
            { config:paradexConfig, signer:paradexSigner }
        );
        console.log('Your Paradex address:', paradexClient.getAddress());
    } catch(error){
        console.error('SDK Error:', error);
    }
    
    if (paradexAction.action == "balance"){
        const balance = await paradexClient!.getTokenBalance('USDC');
        console.log('Balance:', balance.size);
    } else if (paradexAction.action == 'withdraw'){
        await withdraw(paradexClient!, paradexAction);
    }
}
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });