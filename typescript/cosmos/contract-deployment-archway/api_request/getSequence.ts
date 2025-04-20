import axios from "axios";

export async function getSequence(address: string): Promise<bigint> {

  const apiEndpoint = `https://api-archway.mzonder.com/cosmos/auth/v1beta1/accounts/${address}`;

  try {
    const response = await axios.get(apiEndpoint);
    
    if (!response.data || !response.data.account) {
      throw new Error(`Account ${address} not found`);
    }
    
    const sequence = response.data.account.sequence;
    console.log(response.data.account);
    
    return BigInt(sequence);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`API request failed: ${error.message}`);
    }
    throw error;
  }
}