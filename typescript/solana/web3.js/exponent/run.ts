import { 
  getMarketInfo,
  createSetupPayload,
  createInvestPayload, 
  waitForLookupTable,
  getMarketSdk,
  sendPayloadToFordefi,
  getInstructions
} from './serialize_invest';
import { fordefiConfig, exponentConfig, connection } from './config';
import { PublicKey } from '@solana/web3.js';

async function main(): Promise<void> {
  if (!fordefiConfig.accessToken || !fordefiConfig.vaultId || !fordefiConfig.fordefiSolanaVaultAddress) {
    console.error('Error: Please set FORDEFI_API_TOKEN, SOLANA_VAULT_ID, and SOLANA_VAULT_ADDRESS environment variables.');
    return;
  }

  // Log market info at the start
  await getMarketInfo(exponentConfig.market);
  const fordefiVault = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress)

  console.log('--- Fetching market data to get Address Lookup Table ---');
  const marketSdk = await getMarketSdk(exponentConfig.market);
  const lookupTableAddress = marketSdk.addressLookupTable;
  
  if (!lookupTableAddress) {
    console.error('Could not retrieve lookup table from market sdk. Aborting.');
    return;
  }
  console.log(`--- Using Address Lookup Table: ${lookupTableAddress.toBase58()} ---`);
  
  const { setupIxs, ixs } = await getInstructions(fordefiVault, exponentConfig);

  // --- Step 1: Execute the ATA Setup Transaction ---
  console.log('\n--- Step 1: Executing the ATA Setup Transaction ---');
  const lookupTableAccount = await waitForLookupTable(connection, lookupTableAddress);

  if (!lookupTableAccount) {
    console.error(`Failed to fetch the lookup table: ${lookupTableAddress}. Please ensure the create and extend transactions have been confirmed.`);
    return;
  }
  
  const setupPayload = await createSetupPayload(fordefiConfig, setupIxs, lookupTableAccount);
  
  if (setupPayload) {
    await sendPayloadToFordefi(setupPayload, fordefiConfig);
    console.log('--- Step 1: Complete ---');
  } else {
    console.log('--- Step 1: Skipped (No setup instructions needed) ---');
  }

  // --- Step 2: Execute the Investment Transaction ---
  console.log('\n--- Step 2: Executing the Investment ---');

  const finalLookupTableAccount = (await connection.getAddressLookupTable(lookupTableAddress)).value;
  if (!finalLookupTableAccount) {
    console.error(`Failed to fetch the lookup table: ${lookupTableAddress}.`);
    return;
  }

  const finalPayload = await createInvestPayload(fordefiConfig, exponentConfig, ixs, finalLookupTableAccount);
  
  await sendPayloadToFordefi(finalPayload, fordefiConfig);
  console.log('--- Step 2: Complete ---');
  console.log('\nInvestment transaction sent successfully!');
}

if (require.main === module) {
  main();
};