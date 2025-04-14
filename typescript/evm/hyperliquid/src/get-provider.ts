import { FordefiWeb3Provider } from '@fordefi/web3-provider';
import { fordefiConfig } from './config'
import { ethers } from 'ethers';

// Define provider
let fordefiProvider: FordefiWeb3Provider | null = null;
let provider: ethers.providers.JsonRpcProvider | null = null;

// Function to get/create the provider
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
        console.log("Provider -> ", provider)
        console.log("Fordefi Provider -> ", fordefiProvider)
    }
    
    return provider
};