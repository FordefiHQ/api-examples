export async function createRequest(vault_id: string, message: any) {
    
  const requestJson =  {
    signer_type: 'api_signer',
    sign_mode: 'auto',
    type: 'evm_message',
    details: {
      type: 'personal_message_type',
      raw_data: message,
      chain: 'ethereum_mainnet',
    },
    vault_id: vault_id,
    wait_for_state : 'signed',
  };

  return requestJson;
}
