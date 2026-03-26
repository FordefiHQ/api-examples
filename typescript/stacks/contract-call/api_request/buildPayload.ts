import {
  makeUnsignedContractCall,
  uintCV,
  intCV,
  tupleCV,
  listCV,
  contractPrincipalCV,
  PostConditionMode,
} from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { FordefiConfig, ContractCallParams, BinConfig } from '../interfaces/inferfaces';

function buildBinTuple(bin: BinConfig, params: ContractCallParams) {
  return tupleCV({
    'amount': uintCV(bin.amount),
    'bin-id': intCV(bin.binId),
    'min-x-amount': uintCV(bin.minXAmount),
    'min-y-amount': uintCV(bin.minYAmount),
    'pool-trait': contractPrincipalCV(params.poolTraitAddress, params.poolTraitName),
    'x-token-trait': contractPrincipalCV(params.xTokenAddress, params.xTokenName),
    'y-token-trait': contractPrincipalCV(params.yTokenAddress, params.yTokenName),
  });
}

export async function createRequest(
  fordefiConfig: FordefiConfig,
  params: ContractCallParams,
) {
  // smart contract function arguments
  const binTuples = params.bins.map(bin => buildBinTuple(bin, params));
  const functionArgs = [listCV(binTuples)];

  const unsignedTx = await makeUnsignedContractCall({
    contractAddress: params.contractAddress,
    contractName: params.contractName,
    functionName: params.functionName,
    functionArgs,
    network: STACKS_MAINNET,
    fee: BigInt(params.fee),
    publicKey: '00'.repeat(33), // placeholder — Fordefi replaces auth
    postConditionMode: PostConditionMode.Allow,
  });

  const serializedTx = '0x' + unsignedTx.serialize();
  console.log(`Serialized TX length: ${serializedTx.length} chars`);

  return {
    signer_type: "api_signer",
    vault_id: fordefiConfig.vaultId,
    sign_mode: "auto",
    type: "stacks_transaction",
    note: params.note,
    wait_for_state: "completed",
    details: {
      type: "stacks_serialized_transaction",
      chain: "stacks_mainnet",
      serialized_transaction: serializedTx,
      push_mode: "auto",
      skip_prediction: false,
      fail_on_prediction_failure: true,
      fee: {
        type: "custom",
        total_fee: params.fee,
      },
    },
  };
}
