/**
 * Build a Fordefi API payload for EIP-712 typed message signing.
 *
 * @param vaultId  - Fordefi vault UUID
 * @param rawData  - Hex-encoded EIP-712 JSON (0x-prefixed)
 * @param chain    - Chain identifier, e.g. "evm_1337", "evm_42161"
 */
export function buildTypedMessagePayload(
  vaultId: string,
  rawData: string,
  chain: string,
) {
  return {
    vault_id: vaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "evm_message",
    details: {
      type: "typed_message_type",
      raw_data: rawData,
      chain,
    },
    wait_for_state: "signed",
    timeout: 45,
  };
}

/**
 * Build a Fordefi API payload for an on-chain EVM transaction (e.g. contract call).
 *
 * @param vaultId  - Fordefi vault UUID
 * @param chain    - Chain identifier, e.g. "arbitrum_mainnet"
 * @param to       - Destination contract address
 * @param data     - Hex-encoded calldata
 * @param value    - Value in WEI (use "0" for pure contract calls)
 * @param pushMode - "auto" to broadcast, "manual" to get signed tx without broadcasting
 */
export function buildEvmTransactionPayload(
  vaultId: string,
  chain: string,
  to: string,
  data: string,
  value: string,
  pushMode: "auto" | "manual",
) {
  return {
    vault_id: vaultId,
    signer_type: "api_signer",
    sign_mode: "auto",
    type: "evm_transaction",
    details: {
      type: "evm_raw_transaction",
      chain,
      to,
      data: {
        type: "hex",
        hex_data: data,
      },
      value,
      push_mode: pushMode,
      gas: {
        type: "priority",
        priority_level: "medium",
        details: {
          type: "dynamic",
        },
      },
    },
  };
}
