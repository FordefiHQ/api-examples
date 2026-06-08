/**
 * Build a Fordefi API payload for a native Bitcoin transfer.
 *
 * @param vaultId     - Fordefi vault UUID
 * @param chain       - UTXO chain (kept for signature compatibility; the chain
 *                      is now inferred from the vault, so it is no longer placed
 *                      in the payload)
 * @param destination - Destination BTC address
 * @param value       - Amount to send, in satoshis
 * @param note        - Optional note attached to the transaction
 */
export function buildBitcoinTransactionPayload(
  vaultId: string,
  destination: string,
  value: string,
  note: string,
) {
  return {
    vault_id: vaultId,
    note,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "utxo_transaction",
    details: {
      type: "utxo_transfer",
      outputs: [
        {
          to: {
            type: "address",
            address: destination,
          },
          value,
        },
      ],
      fee_per_byte: {
        type: "priority",
        priority_level: "high",
      },
      push_mode: "auto",
    },
  };
}
