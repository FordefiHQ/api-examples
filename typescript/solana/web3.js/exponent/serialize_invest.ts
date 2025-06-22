import { Connection, PublicKey, TransactionInstruction, VersionedTransaction, AddressLookupTableAccount, TransactionMessage, ComputeBudgetProgram } from '@solana/web3.js';
import { LOCAL_ENV, Market } from "@exponent-labs/exponent-sdk";
import { FordefiSolanaConfig, ExponentConfig} from './config'
import { getPriorityFees } from './utils/get_priority_fees'
import { createAndSignTx } from './utils/process_tx'
import { signWithApiSigner } from './signer';
import * as dotenv from 'dotenv';

dotenv.config();

let marketSdk: Market | null = null;

export async function getMarketSdk(marketAddress: string, connection: Connection): Promise<Market> {
  if (!marketSdk) {
    const market = new PublicKey(marketAddress);
    marketSdk = await Market.load(LOCAL_ENV, connection, market);
  }
  return marketSdk;
}

export async function sendPayloadToFordefi(payload: any, fordefiConfig: FordefiSolanaConfig) {
  const requestBody = JSON.stringify(payload);
  const timestamp = new Date().getTime();
  const signature = await signWithApiSigner(`${fordefiConfig.apiPathEndpoint}|${timestamp}|${requestBody}`, fordefiConfig.privateKeyPem);
  
  console.log('Sending payload to Fordefi...');
  const response = await createAndSignTx(fordefiConfig.apiPathEndpoint, fordefiConfig.accessToken, signature, timestamp, requestBody);
  console.log('Fordefi API Response:', response.data);

  console.log('Waiting for on-chain confirmation...');
  await new Promise(resolve => setTimeout(resolve, 5000)); 

  return response.data;
}

function buildFordefiRequestBody(
  fordefiConfig: FordefiSolanaConfig,
  serializedMessage: string
) {
  return {
    "vault_id": fordefiConfig.vaultId,
    "signer_type": "api_signer",
    "sign_mode": "auto",
    "type": "solana_transaction",
    "details": {
      "fee": {
        "type": "priority",
        "priority_level": "medium"
      },
      "type": "solana_serialized_transaction_message",
      "push_mode": "auto",
      "data": serializedMessage,
      "chain": "solana_mainnet"
    },
    "wait_for_state": "signed"
  };
}

async function createAndSerializeTransaction(
  connection: Connection,
  payerKey: PublicKey,
  instructions: TransactionInstruction[],
  lookupTables: AddressLookupTableAccount[] = []
): Promise<string> {
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 600_000, // it's a complex tx, we need a lot of CU!
  });
  const setComputeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: await getPriorityFees(instructions, connection),
  });
  
  const messageV0 = new TransactionMessage({
    payerKey,
    recentBlockhash,
    instructions: [setComputeUnitLimitIx, setComputeUnitPriceIx, ...instructions],
  }).compileToV0Message(lookupTables);
  
  const tx = new VersionedTransaction(messageV0);
  
  return Buffer.from(tx.message.serialize()).toString('base64');
}

export async function waitForLookupTable(connection: Connection, lookupTableAddress: PublicKey, maxRetries: number = 10): Promise<AddressLookupTableAccount> {
  console.log('Waiting for Address Lookup Table to be available...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const lutAccount = (await connection.getAddressLookupTable(lookupTableAddress)).value;
      if (lutAccount) {
        console.log(`✓ Address Lookup Table found after ${attempt} attempt(s)`);
        return lutAccount;
      }
    } catch (error) {
      console.log(`Attempt ${attempt}: ALT not ready yet...`);
    }
    
    // Exponential backoff: 2^attempt seconds, max 30 seconds
    const delay = Math.min(Math.pow(2, attempt), 30) * 1000;
    console.log(`Waiting ${delay / 1000} seconds before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  throw new Error(`Failed to fetch ALT after ${maxRetries} attempts: ${lookupTableAddress.toBase58()}`);
}

// Get current market information
export async function getMarketInfo(marketAddress: string, connection: Connection) {
  const sdk = await getMarketSdk(marketAddress, connection);
  console.log('--- Market Info ---');
  console.log('Current SY exchange rate:', sdk.currentSyExchangeRate.toString());
  console.log('Current PT discount:', sdk.ptDiscount.toString());
  
  // Example conversions
  const ybtAmount = 1000; // fragSOL amount
  const baseAmount = ybtAmount * sdk.currentSyExchangeRate;
  console.log(`${ybtAmount} fragSOL = ${baseAmount} SOL (base)`);
  
  const baseAmount2 = 1000; // SOL amount
  const ybtAmount2 = baseAmount2 / sdk.currentSyExchangeRate;
  console.log(`${baseAmount2} SOL (base) = ${ybtAmount2} fragSOL`);
  
  return {
    syExchangeRate: sdk.currentSyExchangeRate,
    ptDiscount: sdk.ptDiscount
  };
}

// Simulate buying PT with base asset
export async function simulateBuyPt(marketAddress: string, baseAssetAmount: number, connection: Connection) {
  try {
    const sdk = await getMarketSdk(marketAddress, connection);
    const estimatedPt = sdk.marketCalculator().estimateNetPtForExactNetAsset(-baseAssetAmount);
    if (estimatedPt === null) {
      console.log(`No PT estimate available for ${baseAssetAmount} base asset`);
      return null;
    }
    console.log(`Estimated PT for ${baseAssetAmount} base asset:`, estimatedPt.toString());
    return BigInt(Math.floor(estimatedPt)); // Round down to integer before converting
  } catch (error) {
    console.error('Error simulating buy PT:', error);
    throw error;
  }
}

// Simulate selling PT for base asset
export async function simulateSellPt(marketAddress: string, ptInAmount: number, connection: Connection) {
  try {
    const sdk = await getMarketSdk(marketAddress, connection);
    const estimatedBaseAsset = sdk.marketCalculator().calcTradePt(-ptInAmount);
    console.log(`Estimated base asset for selling ${ptInAmount} PT:`, estimatedBaseAsset);
    
    const netAssetOut = estimatedBaseAsset.netTraderAsset;
    
    if (netAssetOut === undefined) {
      throw new Error('Could not find output amount in CalculatorTradeResult');
    }
    
    return BigInt(Math.floor(netAssetOut));
  } catch (error) {
    console.error('Error simulating sell PT:', error);
    throw error;
  }
}

export async function createSellPtInstruction(
  marketAddress: string,
  owner: PublicKey, 
  ptAmount: bigint, 
  minBaseOut: bigint,
  connection: Connection
): Promise<{ setupIxs: TransactionInstruction[]; ixs: TransactionInstruction[] }> {
  try {
    const sdk = await getMarketSdk(marketAddress, connection);
    const sellPtIx = await sdk.ixWrapperSellPt({
      owner,
      amount: ptAmount,
      minBaseOut
    });
    
    console.log('Sell PT instruction created:', sellPtIx);
    return { setupIxs: sellPtIx.setupIxs, ixs: sellPtIx.ixs };
  } catch (error) {
    console.error('Error creating sell PT instruction:', error);
    throw error;
  }
}

// Create buy PT instruction
export async function createBuyPtInstruction(
  marketAddress: string, 
  owner: PublicKey, 
  ptOut: bigint, 
  maxBaseIn: bigint,
  connection: Connection
): Promise<{ setupIxs: TransactionInstruction[]; ixs: TransactionInstruction[] }> {
  try {
    const sdk = await getMarketSdk(marketAddress, connection);
    const buyPtIx = await sdk.ixWrapperBuyPt({
      owner,
      ptOut,
      maxBaseIn
    });
    
    console.log('Buy PT instruction created:', buyPtIx);
    return { setupIxs: buyPtIx.setupIxs, ixs: buyPtIx.ixs };
  } catch (error) {
    console.error('Error creating buy PT instruction:', error);
    throw error;
  }
}

// Create a payload for the setup transaction
export async function createSetupPayload(
  fordefiConfig: FordefiSolanaConfig,
  setupIxs: TransactionInstruction[],
  lookupTable: AddressLookupTableAccount
) {
  console.log('=== Creating Setup Transaction Payload ===');
  const owner = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress);
  const connection = new Connection('https://api.mainnet-beta.solana.com');

  if (setupIxs.length === 0) {
    console.log('No setup instructions needed.');
    return null;
  }

  // Check which of the required Associated Token Accounts already exist.
  // The ATA address is the second key in the `createAssociatedTokenAccount` instruction.
  const ataAddresses = setupIxs.map(ix => ix.keys[1]?.pubkey).filter(Boolean) as PublicKey[];
  const existingAccounts = await connection.getMultipleAccountsInfo(ataAddresses);

  // Filter for instructions where the account does not exist yet (is null).
  const neededSetupIxs = setupIxs.filter((_, index) => existingAccounts[index] === null);

  if (neededSetupIxs.length === 0) {
    console.log('All required Associated Token Accounts already exist. Skipping setup transaction.');
    return null;
  }

  console.log(`Found ${neededSetupIxs.length} new Associated Token Accounts to create.`);
  const serializedMessage = await createAndSerializeTransaction(
    connection,
    owner,
    neededSetupIxs,
    [lookupTable]
  );
  
  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
}

// Create a payload for the main investment transaction
export async function createInvestPayload(
  fordefiConfig: FordefiSolanaConfig,
  exponentConfig: ExponentConfig,
  ixs: TransactionInstruction[],
  lookupTable: AddressLookupTableAccount
) {
  console.log('=== Exponent Market SDK Investment ===');
  console.log(`Action: ${exponentConfig.action}`);
  console.log(`Amount: ${exponentConfig.investAmount}`);
  
  const owner = new PublicKey(fordefiConfig.fordefiSolanaVaultAddress);
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  
  const serializedMessage = await createAndSerializeTransaction(
    connection,
    owner,
    ixs,
    [lookupTable]
  );
  
  return buildFordefiRequestBody(fordefiConfig, serializedMessage);
}

export async function getInstructions(owner: PublicKey, exponentConfig: ExponentConfig, connection: Connection) {
  const sdk = await getMarketSdk(exponentConfig.market, connection);

  switch (exponentConfig.action) {
    case 'buy':
      const investAmountInBaseAsset = BigInt(Math.floor(Number(exponentConfig.investAmount) * sdk.currentSyExchangeRate));
      const estimatedPt = await simulateBuyPt(exponentConfig.market, Number(investAmountInBaseAsset), connection);
      if (!estimatedPt) {
        throw new Error('Could not estimate PT amount for buy');
      }
      
      const ptOut = estimatedPt * 99n / 100n; // 1% slippage tolerance
      
      return createBuyPtInstruction(
        exponentConfig.market,
        owner,
        ptOut,
        investAmountInBaseAsset,
        connection
      );
      
    case 'sell':
      const estimatedBase = await simulateSellPt(exponentConfig.market, Number(exponentConfig.investAmount), connection);
      if (!estimatedBase) {
        throw new Error('Could not estimate base amount for sell');
      }
      
      const minBaseOut = estimatedBase * 99n / 100n; // 1% slippage tolerance
      const ptAmount = exponentConfig.investAmount;
      
      return createSellPtInstruction(
        exponentConfig.market,
        owner,
        ptAmount,
        minBaseOut,
        connection
      );
      
    default:
      throw new Error(`Unsupported action: ${exponentConfig.action}`);
  }
}