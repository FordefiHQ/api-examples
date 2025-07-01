export async function createRequest(vault_id: string, signatureDataB64: string) {
    const requestJson =  {
        vault_id: vault_id,
        note: 'Testing SUI',
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: "sui_transaction",
        details: {
          type: "sui_binary_canonical_serialization",
          chain: "sui_mainnet",
          data: signatureDataB64,
        },
        wait_for_state: 'signed'
    };

    return requestJson;
}
