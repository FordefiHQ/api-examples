import { fordefiConfig, suiNetwork, compiledModulesandDependencies } from './configs';
import { submitTransactionToFordefi } from './serialize-tx'
import { Transaction } from '@mysten/sui/transactions'
import { SuiClient } from '@mysten/sui/client';
import { readFileSync } from 'fs';

async function publishPackage() {
  const client = new SuiClient({ url: suiNetwork });

  const buildOutput = readFileSync(compiledModulesandDependencies, 'utf-8');
  const { modules, dependencies } = JSON.parse(buildOutput);

  const tx = new Transaction();
  tx.setSender(fordefiConfig.senderAddress);
  tx.setGasOwner(fordefiConfig.senderAddress);
  
  const upgradeCap = tx.publish({ modules, dependencies });
  
  tx.transferObjects([upgradeCap], fordefiConfig.senderAddress);
  tx.setGasBudget(100_000_000n);

  const fordDefiResult = await submitTransactionToFordefi(client, tx, fordefiConfig.vaultId, fordefiConfig.accessToken);

  console.log("Publish result:", fordDefiResult);
}
publishPackage().catch(console.error);