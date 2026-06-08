import { DepositAddressResponse } from "./interfaces";
import { BASE_UNIT_API_URL } from "./config";

export async function get_deposit_address(hyperliquid_address: string): Promise<DepositAddressResponse> {
    let response = await fetch(`${BASE_UNIT_API_URL}/gen/bitcoin/hyperliquid/btc/${hyperliquid_address}`, {
    method: "GET"
    });
    const data = (await response.json()) as DepositAddressResponse;
    return data
}