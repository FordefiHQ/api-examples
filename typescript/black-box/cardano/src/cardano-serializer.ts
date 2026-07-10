import axios from 'axios';
import * as CSL from '@emurgo/cardano-serialization-lib-nodejs';
import { BLOCKFROST_BASE_URL, BLOCKFROST_PROJECT_ID, cardanoConfig } from './cardano-config';

interface BlockfrostAmount {
    unit: string;
    quantity: string;
}

interface BlockfrostUtxo {
    tx_hash: string;
    output_index: number;
    amount: BlockfrostAmount[];
}

export type BuildCtx = {
    protocolParams: any;
    currentSlot: number;
    ownAddress: CSL.Address;
};

async function blockfrostGet(path: string): Promise<any> {
    const resp = await axios.get(`${BLOCKFROST_BASE_URL}${path}`, {
        headers: { project_id: BLOCKFROST_PROJECT_ID },
        validateStatus: () => true,
    });
    if (resp.status === 404) return null;
    if (resp.status !== 200) {
        throw new Error(`Blockfrost ${resp.status} on ${path}: ${JSON.stringify(resp.data)}`);
    }
    return resp.data;
}

async function getProtocolParameters(): Promise<any> {
    return blockfrostGet('/epochs/latest/parameters');
}

async function getUtxos(address: string): Promise<BlockfrostUtxo[]> {
    // Blockfrost returns 404 for addresses that have never appeared on-chain.
    const utxos = await blockfrostGet(`/addresses/${address}/utxos`);
    return utxos ?? [];
}

async function getCurrentSlot(): Promise<number> {
    const block = await blockfrostGet('/blocks/latest');
    return block.slot;
}

// null = stake key has never appeared on-chain (i.e. not registered).
export async function getAccountInfo(stakeAddress: string): Promise<any | null> {
    return blockfrostGet(`/accounts/${stakeAddress}`);
}

export function assertAboveMinAda(output: CSL.TransactionOutput, protocolParams: any): void {
    const minAda = CSL.min_ada_for_output(
        output,
        CSL.DataCost.new_coins_per_byte(CSL.BigNum.from_str(String(protocolParams.coins_per_utxo_size))),
    );
    const amount = output.amount().coin();
    if (amount.less_than(minAda)) {
        throw new Error(
            `Amount ${amount.to_str()} lovelace is below the min-UTxO floor of ${minAda.to_str()} lovelace.`,
        );
    }
}

// Shared pipeline: fetch UTxOs/params/slot, let the caller configure the tx
// (outputs, certificates, withdrawals), then select inputs, add change, and
// package the blake2b-256 body hash as a Fordefi black_box_signature payload.
export async function buildCardanoPayload(
    originAddress: string,
    vaultId: string,
    configure: (builder: CSL.TransactionBuilder, ctx: BuildCtx) => void | Promise<void>,
) {
    const allUtxos = await getUtxos(originAddress);
    if (allUtxos.length === 0) {
        throw new Error(
            `No UTxOs found for ${originAddress}. Fund the address with ADA first (run "npm run derive" to print it).`,
        );
    }

    // Only spend pure-ADA UTxOs so the example can never accidentally move native tokens.
    const lovelaceUtxos = allUtxos.filter(
        (u) => u.amount.length === 1 && u.amount[0]!.unit === 'lovelace',
    );
    const skipped = allUtxos.length - lovelaceUtxos.length;
    if (skipped > 0) {
        console.warn(`Skipping ${skipped} UTxO(s) holding native tokens.`);
    }
    if (lovelaceUtxos.length === 0) {
        throw new Error(`All UTxOs at ${originAddress} hold native tokens; a pure-ADA UTxO is required.`);
    }

    const [protocolParams, currentSlot] = await Promise.all([getProtocolParameters(), getCurrentSlot()]);

    const ownAddress = CSL.Address.from_bech32(originAddress);
    const utxos = CSL.TransactionUnspentOutputs.new();
    for (const u of lovelaceUtxos) {
        utxos.add(
            CSL.TransactionUnspentOutput.new(
                CSL.TransactionInput.new(CSL.TransactionHash.from_hex(u.tx_hash), u.output_index),
                CSL.TransactionOutput.new(ownAddress, CSL.Value.new(CSL.BigNum.from_str(u.amount[0]!.quantity))),
            ),
        );
    }

    const builderConfig = CSL.TransactionBuilderConfigBuilder.new()
        .fee_algo(
            CSL.LinearFee.new(
                CSL.BigNum.from_str(String(protocolParams.min_fee_a)),
                CSL.BigNum.from_str(String(protocolParams.min_fee_b)),
            ),
        )
        .coins_per_utxo_byte(CSL.BigNum.from_str(String(protocolParams.coins_per_utxo_size)))
        .pool_deposit(CSL.BigNum.from_str(String(protocolParams.pool_deposit)))
        .key_deposit(CSL.BigNum.from_str(String(protocolParams.key_deposit)))
        .max_value_size(Number(protocolParams.max_val_size))
        .max_tx_size(Number(protocolParams.max_tx_size))
        .build();

    const builder = CSL.TransactionBuilder.new(builderConfig);

    await configure(builder, { protocolParams, currentSlot, ownAddress });

    builder.set_ttl_bignum(CSL.BigNum.from_str(String(currentSlot + cardanoConfig.ttlBufferSlots)));
    builder.add_inputs_from(utxos, CSL.CoinSelectionStrategyCIP2.LargestFirst);
    builder.add_change_if_needed(ownAddress); // sets the fee and adds a change output
    const txBody = builder.build();

    // FixedTransaction pins the exact body bytes: the hash we send to Fordefi is guaranteed
    // to match the bytes we later submit (re-serialization can otherwise drift).
    const fixedTx = CSL.FixedTransaction.new_from_body_bytes(txBody.to_bytes());
    const txHash = Buffer.from(fixedTx.transaction_hash().to_bytes()); // 32-byte blake2b-256

    const payload = {
        vault_id: vaultId,
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: 'black_box_signature',
        details: {
            format: 'hash_binary',
            hash_binary: txHash.toString('base64'),
        },
    };

    return { payload, fixedTx };
}
