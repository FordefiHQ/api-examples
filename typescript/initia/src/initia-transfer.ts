import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { signWithApiSigner } from '../api_request/signer';
import { createAndSignTx } from '../api_request/pushToApi';
import { getProvider } from '../utils/get-provider';
import { createRequest } from '../api_request/form_request';
import { 
  RESTClient,
  MsgSend,
  Fee,
  ModeInfo,
  SignMode,
  SignerInfo,
  AuthInfo,
  TxBody,
  Tx,
  EthPublicKey,
  Coin
} from '@initia/initia.js';
import { AminoSignDoc } from '../utils/interfaces'
import { toHex, fromHex, toBase64, fromBase64 } from '@cosmjs/encoding';
import { fordefiConfig, transferConfig, PATH, PK_PATH, FORDEFI_EVM_VAULT_ID } from './config';

dotenv.config();

async function main() {
  const eip1193 = await getProvider(fordefiConfig);
  if (!eip1193) throw new Error('Failed to initialise provider');

  const web3Provider = new ethers.BrowserProvider(eip1193);
  const ethSigner = await web3Provider.getSigner();
  console.log('Ethereum address:', fordefiConfig.address);

  const ethPubKey = await getEthPublicKey(ethSigner);
  console.log("EthPubkey ->", ethPubKey)
  const converter = require("bech32-converting")
  const initiaAddress = converter('init').toBech32(fordefiConfig.address);
  console.log('Initia address:', initiaAddress);

  await executeTxWithFordefi(initiaAddress, ethPubKey);
}

async function executeTxWithFordefi(
  initiaAddress: string,
  ethPubKey: EthPublicKey,
) {

  const rest = new RESTClient('https://rest.initia.xyz', {
    chainId: 'interwoven-1',
    gasPrices: '1uinit',
    gasAdjustment: '1.75',
  });

  const acct = await rest.auth.accountInfo(initiaAddress);
  const acctNumber = acct.getAccountNumber();
  const sequence  = acct.getSequenceNumber();
  console.log('Account info:', { acctNumber, sequence });

  const msg = new MsgSend(
    initiaAddress,   
    transferConfig.destination,      
    [new Coin('uinit', transferConfig.amountToTransfer)] 
  );

  const fee = new Fee(transferConfig.gasLimit, [new Coin('uinit', transferConfig.gasPrice)]);
  const modeInfo  = new ModeInfo(
    new ModeInfo.Single(SignMode.SIGN_MODE_EIP_191) 
  );
  const signerInfo = new SignerInfo(ethPubKey, Number(sequence), modeInfo);
  const authInfo = new AuthInfo([signerInfo], fee);

  const txBody = new TxBody([msg], '', 0);

  const rsBase64 = await fordefiSignEIP191({
    chainId: 'interwoven-1',
    accountNumber: acctNumber,
    sequence: sequence,
    fee: fee,
    msgs: [msg],
    memo: ''
  });

  const tx = new Tx(txBody, authInfo, [rsBase64]);
  console.log("Tx Sig", tx.signatures)

  await broadcastTransaction(rest, tx);
}

async function fordefiSignEIP191(signDocData: {
  chainId: string;
  accountNumber: number;
  sequence: number;
  fee: Fee;
  msgs: any[];
  memo: string;
}): Promise<string> {

  const feeAmino = {
    amount: signDocData.fee.amount.toArray().map(coin => ({
      amount: coin.amount.toString(),
      denom: coin.denom
    })),
    gas: signDocData.fee.gas_limit.toString(),
  };

  const msgsAmino = signDocData.msgs.map(msg => {
    if (msg instanceof MsgSend) {
      return {
        type: "cosmos-sdk/MsgSend",
        value: {
          amount: msg.amount.toArray().map((coin: Coin) => ({
            amount: coin.amount.toString(),
            denom: coin.denom
          })),
          from_address: msg.from_address,
          to_address: msg.to_address
        }
      };
    }
    throw new Error(`Unsupported message type: ${msg.constructor.name}`);
  });

  const aminoSignDoc: AminoSignDoc = {
    account_number: signDocData.accountNumber.toString(),
    chain_id: signDocData.chainId,
    fee: feeAmino,
    memo: signDocData.memo,
    msgs: msgsAmino,
    sequence: signDocData.sequence.toString()
  };

  function sortObject<T>(obj: T): T {
    if (Array.isArray(obj)) {
        return obj.map(sortObject) as T;
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).sort().reduce((result, key) => {
            result[key as keyof T] = sortObject(obj[key as keyof T]);
            return result;
        }, {} as T);
    }
    return obj;
  }

  const sortedSignDoc = sortObject(aminoSignDoc);
  const message = JSON.stringify(sortedSignDoc);

  const reqBody = await createRequest(FORDEFI_EVM_VAULT_ID, message)
  const bodyJSON = JSON.stringify(reqBody);
  const ts = Date.now();
  const payload = `${PATH}|${ts}|${bodyJSON}`;
  const headerSig = await signWithApiSigner(PK_PATH, payload);  

  const response = await createAndSignTx(
    PATH,
    fordefiConfig.apiUserToken,
    headerSig,
    ts,
    bodyJSON,
  );
  
  const result = response.data;
  console.log('Fordefi response:', result);

  if (!result.signatures?.length) throw new Error('No signatures returned');
  const sig = result.signatures[0];
  console.log('Raw signature (base64):', sig);
  
  const sigBytes = fromBase64(sig);
    
  const r = sigBytes.slice(0, 32);
  const s = sigBytes.slice(32, 64);
  const v = sigBytes[64]; // v is not used for Cosmos/Initia
  
  console.log('r (hex):', toHex(r));
  console.log('s (hex):', toHex(s));
  console.log('v (NOT used):', v); // NOT USED just FYI
  
  const combinedSig = new Uint8Array([...r, ...s]);
  return toBase64(combinedSig);   
}

function compress(uncompressedHex: string): string {
  const hex = uncompressedHex.slice(2);
  const x = hex.slice(2, 66);
  const y = hex.slice(66);
  const prefix = (BigInt('0x' + y) & 1n) === 0n ? '02' : '03';
  return '0x' + prefix + x;
}

async function getEthPublicKey(ethSigner: ethers.Signer): Promise<EthPublicKey> {
  const msg = 'Initia public key derivation';
  const sig = await ethSigner.signMessage(msg);
  const hash = ethers.hashMessage(msg);
  const uncmp = ethers.SigningKey.recoverPublicKey(hash, sig);
  const cmp = compress(uncmp);
  return new EthPublicKey(toBase64(fromHex(cmp.slice(2))));
}

async function broadcastTransaction(rest: RESTClient, tx: Tx) {
  console.log('Transaction to broadcast:', {
    body: tx.body,
    authInfo: tx.auth_info,
    signatures: tx.signatures,
  });

  const res = await rest.tx.broadcast(tx);
  console.log('Broadcast result:', res);

  if (!res.txhash) {
    console.error('❌ CheckTx failed:', res.raw_log || res);
    return;
  }

  const hash = res.txhash;
  const maxTries = 20;
  const delayMs = 3_000;

  console.log('🛰  Waiting for inclusion…');
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, delayMs));

    try {
      const status = await rest.tx.txInfo(hash);
      if (status && status.height > 0) {
        if (status.code === 0) {
          console.log(`🎉  Success in block ${status.height}`);
          console.log(`🔗  https://scan.initia.xyz/tx/${hash}`);
          return;
        } else {
          console.error(`❌  Failed in block ${status.height}: ${status.raw_log}`);
          return;
        }
      }
    } catch (error) {
      console.log(`⏳  Pending… (${i + 1}/${maxTries}) - ${error}`);
    }
  }

  console.warn(
    '⌛  Timed out after 60 s. Check later:',
    `https://scan.initia.xyz/tx/${hash}`,
  );
}

main().catch(console.error);