import { FordefiWeb3Provider, FordefiProviderConfig} from '@fordefi/web3-provider';

export async function getProvider(fordefiConfig: FordefiProviderConfig) {
    let fordefiProvider = new FordefiWeb3Provider(fordefiConfig);
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
    return fordefiProvider;
}