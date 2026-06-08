import {TESTNET_GUARDIAN_NODES, MAINNET_GUARDIAN_NODES, GUARDIAN_SIGNATURE_THRESHOLD} from './constants'
import { FordefiApiConfig } from './interfaces'
import dotenv from 'dotenv';

dotenv.config()

export type UnitApiUrl = "https://api.hyperunit-testnet.xyz" | "https://api.hyperunit.xyz"

type Network = "testnet" | "mainnet"
const NETWORK: Network = "mainnet"

const CHAIN_FOR_NETWORK: Record<Network, FordefiApiConfig["chain"]> = {
    testnet: "bitcoin_testnet_v4",
    mainnet: "bitcoin_mainnet",
}

export const fordefiConfig: FordefiApiConfig = {
    chain: CHAIN_FOR_NETWORK[NETWORK],
    hyperliquid_address: process.env.HYPERLIQUID_ADDRESS!.trim(),
    address: process.env.FORDEFI_BITCOIN_VAULT_ADDRESS!,
    vaultId: process.env.FORDEFI_BITCOIN_VAULT_ID!,
    accessToken: process.env.FORDEFI_API_USER_TOKEN!,
    privateKeyPath: './secret/private.pem',
    pathEndpoint: '/api/v1/transactions',
    pushMode: 'auto',
    transferAmount: process.env.BTC_TRANSFER_AMOUNT!,
}

export const BASE_UNIT_API_URL: UnitApiUrl = {
    testnet: "https://api.hyperunit-testnet.xyz",
    mainnet: "https://api.hyperunit.xyz",
}[NETWORK] as UnitApiUrl
export const GUARDIANS = {
    testnet: TESTNET_GUARDIAN_NODES,
    mainnet: MAINNET_GUARDIAN_NODES,
}[NETWORK]
export const GUARDIAN_SIGNATURES = GUARDIAN_SIGNATURE_THRESHOLD