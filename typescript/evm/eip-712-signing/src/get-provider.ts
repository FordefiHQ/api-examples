import { FordefiWeb3Provider } from '@fordefi/web3-provider';
import { fordefiConfig } from './config'
import { ethers } from 'ethers';

let fordefiProvider: FordefiWeb3Provider | null = null;
let provider: ethers.providers.Web3Provider | null = null; // we're using Web3Provider because we're using ethers@^5.8.0

export async function getProvider() {
    if (!fordefiProvider) {
        fordefiProvider = new FordefiWeb3Provider(fordefiConfig);
        await new Promise<void>(resolve => {
            const onFirstConnect = (result: any) => {
                resolve();
                try {
                    fordefiProvider?.removeListener('connect', onFirstConnect);
                    console.log("Successfully removed the listener")
                } catch (e) {
                    console.error("The listener couln't be removed: ", e)
                }
                console.log(`Connected to chain: ${result.chainId}`);
            };
            fordefiProvider!.on('connect', onFirstConnect);
        })
        provider = new ethers.providers.Web3Provider(fordefiProvider);
    }
    
    return provider;
}