import axios from 'axios';


export async function triggerFordefiSigning(transactionId: string, fordefi_api_user_token: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `https://api.fordefi.com/api/v1/transactions/${transactionId}/trigger-signing`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${fordefi_api_user_token}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`Successfully triggered signing for transaction: ${transactionId}`);
      return true;
    } else {
      console.error(`Failed to trigger signing (${response.status}):`, JSON.stringify(response.data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.error(`Error triggering signing for transaction: ${transactionId}`, error);
    return false;
  }
}