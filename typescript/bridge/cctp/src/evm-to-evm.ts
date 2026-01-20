import "dotenv/config";
import { inspect } from "util";
import { getProvider } from './get-provider';
import { BridgeKit } from "@circle-fin/bridge-kit";
import { fordefiConfigFrom, fordefiConfigTo, bridgeCongfig } from './config';
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

async function main(): Promise<void> {
  const kit = await new BridgeKit();
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
    config: {
      // Use SLOW for free transfers, or FAST with explicit maxFee
      transferSpeed: 'FAST',
      maxFee: "100000", // 0.1 USDC max fee in smallest units
    },
  } as any);

  if (result.state === 'success') {
    const amount = (parseInt(result.amount) / 1e6).toFixed(2);
    console.log(`\n✅ Bridge successful: ${amount} USDC`);
    console.log(`   ${result.source.chain.name} → ${result.destination.chain.name}`);
    result.steps.forEach((step: any) => {
      if (step.explorerUrl) {
        console.log(`   ${step.name}: ${step.explorerUrl}`);
      }
    });
  } else {
    console.log("\n❌ Bridge failed:");
    console.log(inspect(result, false, null, true));
  }
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
