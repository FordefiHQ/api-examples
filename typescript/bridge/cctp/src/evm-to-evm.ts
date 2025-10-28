import "dotenv/config";
import { inspect } from "util";
import { getProvider } from './get-provider';
import { BridgeKit } from "@circle-fin/bridge-kit";
import { fordefiConfigFrom, fordefiConfigTo, bridgeCongfig } from './config';
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

async function main(): Promise<void> {
  const kit = await new BridgeKit();
  
  // We need to initialize 2 providers (from and to) since the Fordefi provider doesn't support chain switching
  const from_provider = await getProvider(fordefiConfigFrom);
  if (!from_provider) {
    throw new Error("Failed to initialize provider");
  }

  const to_provider = await getProvider(fordefiConfigTo);
  if (!to_provider) {
    throw new Error("Failed to initialize provider");
  }

  const adapterFrom = await createAdapterFromProvider({
    provider: from_provider as any,
    capabilities: {
      addressContext: 'user-controlled'
    }
  });

  const adapterTo = await createAdapterFromProvider({
    provider: to_provider as any,
    capabilities: {
      addressContext: 'user-controlled'
    }
  });

  console.log("---------------Starting Bridging---------------");
  const result = await kit.bridge({
    from: { adapter: adapterFrom, chain: bridgeCongfig.chainFrom },
    to: { 
      adapter: adapterTo, 
      chain: bridgeCongfig.chainTo,
      recipientAddress: bridgeCongfig.destinationAddress
    },
    amount: bridgeCongfig.amount,
  } as any);

  console.log("RESULT", inspect(result, false, null, true));
}

main().catch((err) => {
  console.error("ERROR", inspect(err, false, null, true));
  process.exit(1);
});
