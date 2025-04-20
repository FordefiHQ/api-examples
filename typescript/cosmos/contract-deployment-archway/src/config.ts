import dotenv from 'dotenv'

dotenv.config()

export const fordefiConfig = {
  accessToken: process.env.FORDEFI_API_USER_TOKEN ?? "",
  vaultId: process.env.FORDEFI_COSMOS_VAULT_ID || "",
  senderAddress:process.env.FORDEFI_COSMOS_ARCHWAY_ADDRESS || "",
  compressedPubKey: process.env.FORDEFI_COSMOS_VAULT_COMPRESSED_PUBKEY || "", // public_key_compressed value when GET https://api.fordefi.com/api/v1/vaults/{id}
  privateKeyPath: "./secret/private.pem",
  pathEndpoint:  "/api/v1/transactions",
  gasPrice: 140_000_000_000n,
  gasLimit: 600_000n
};