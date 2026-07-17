from enum import Enum


class TransactionType(Enum):
    UTXO_TRANSACTION = "utxo_transaction"
    EVM_TRANSACTION = "evm_transaction"
    EVM_MESSAGE = "evm_message"
    SOLANA_TRANSACTION = "solana_transaction"
    SOLANA_MESSAGE =  "solana_message"
    EXCHANGE_TRANSACTION = "exchange_transaction"
    COSMOS_TRANSACTION = "cosmos_transaction"
    APTOS_TRANSACTION = "aptos_transaction"
    SUI_TRANSACTION = "sui_transaction"
    STARKNET_TRANSACTION = "starknet_transaction"
    STARKNET_MESSAGE = "starknet_message"
    TON_TRANSACTION = "ton_transaction"
    TRON_TRANSACTION = "tron_transaction"
    TRON_MESSAGE = "tron_message"
    CANTON_TRANSACTION = "canton_transaction"
    STELLAR_TRANSACTION = "stellar_transaction"
    STELLAR_MESSAGE = "stellar_message"


class SignerType(Enum):
    API_SIGNER = "api_signer"
    INITIATOR = "initiator"


class PushMode(Enum):
    AUTO = "auto"
    MANUAL = "manual"


class SignMode(Enum):
    AUTO = "auto"
    TRIGGERED = "triggered"


class GasType(Enum):
    CUSTOM = "custom"
    PRIORITY = "priority"


class GasDetailsType(Enum):
    LEGACY = "legacy"
    DYNAMIC = "dynamic"


class GasPriorityLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CUSTOM = "custom"


class EvmTransactionDetailType(Enum):
    EVM_RAW_TRANSACTION = "evm_raw_transaction"
    EVM_TRANSFER = "evm_transfer"
    EVM_REVOKE_ALLOWANCE = "evm_revoke_allowance"
    EVM_WRAP_ETH = "evm_wrap_eth"
    EVM_UNWRAP_ETH = "evm_unwrap_eth"
    EVM_CONTRACT_CALL = "contract_call"
    EVM_SET_CODE = "evm_set_code"


class EvmMessageType(Enum):
    TYPED_MESSAGE = "typed_message_type"
    PERSONAL_MESSAGE = "personal_message_type"

class SolanaMessageType(Enum):
    PERSONAL_MESSAGE = "personal_message_type"

class TronMessageType(Enum):
    # Fordefi's Tron message signing takes an OPAQUE message to be signed (V1: hex;
    # V2: plain text or base64). There is no structured typed-data input, so despite
    # the "typed_message" name these are personal message signatures, NOT
    # TIP-712 structured typed data (which needs domain/types/primaryType). V2 maps to
    # TronWeb signMessageV2 (TIP-191-style plaintext signing).
    PERSONAL_MESSAGE_V1 = "typed_message_type_v1"
    PERSONAL_MESSAGE_V2 = "typed_message_type_v2"

class StarknetMessageType(Enum):
    TYPED_MESSAGE = "typed_message_type"  # SNIP-12 (formerly SNIP-712) typed data

class TransactionState(Enum):
    SIGNED = "signed"
    PENDING = "pending"
    COMPLETED = "completed"
    MINED = "mined"
    ABORTED = "aborted"
    FAILED = "failed"
    REJECTED = "rejected"
    APPROVED = "approved"
    STUCK = "stuck"
    PUSHED_TO_BLOCKCHAIN = "pushed_to_blockchain"


class UtxoTransactionDetailType(Enum):
    UTXO_PARTIALLY_SIGNED_BITCOIN_TRANSACTION = "utxo_partially_signed_bitcoin_transaction"


# Chain-specific transaction detail types

class SolanaTransactionDetailType(Enum):
    SOLANA_TRANSFER = "solana_transfer"
    SOLANA_SERIALIZED_TRANSACTION_MESSAGE = "solana_serialized_transaction_message"


class CosmosTransactionDetailType(Enum):
    COSMOS_TRANSFER = "cosmos_transfer"


class AptosTransactionDetailType(Enum):
    APTOS_TRANSFER = "aptos_transfer"


class SuiTransactionDetailType(Enum):
    SUI_TRANSFER = "sui_transfer"

class StarknetTransactionDetailType(Enum):
    STARKNET_TRANSFER = "starknet_transfer"


class TonTransactionDetailType(Enum):
    TON_TRANSFER = "ton_transfer"


class TronTransactionDetailType(Enum):
    TRON_TRANSFER = "tron_transfer"


class CantonTransactionDetailType(Enum):
    CANTON_TRANSFER = "canton_transfer"
    CANTON_PARTY_ALLOCATION = "canton_party_allocation"
    CANTON_PRE_APPROVAL_SETUP = "canton_pre_approval_setup"
    CANTON_APPROVE_TRANSFER = "canton_approve_transfer"


class StellarTransactionDetailType(Enum):
    STELLAR_TRANSFER = "stellar_transfer"
    STELLAR_RAW_TRANSACTION = "stellar_raw_transaction"
    STELLAR_CHANGE_TRUST = "stellar_change_trust"
    STELLAR_CLAIM_CLAIMABLE_BALANCE = "stellar_claim_claimable_balance"


class ExchangeTransactionDetailType(Enum):
    EXTERNAL_WITHDRAW = "external_withdraw"
    INTERNAL_TRANSFER = "internal_transfer"


# Asset identifier types

class AssetIdentifierType(Enum):
    SOLANA = "solana"
    EVM = "evm"
    COSMOS = "cosmos"
    APTOS = "aptos"
    STARKNET = "starknet"
    SUI = "sui"
    TON = "ton"
    TRON = "tron"
    UTXO = "utxo"
    CANTON = "canton"
    STELLAR = "stellar"



class AssetDetailType(Enum):
    NATIVE = "native"
    ERC20 = "erc20"
    JETTON = "jetton"
    NEW_COIN = "new_coin"
    SPL_TOKEN = "spl_token"
    COIN = "coin"
    TRC20 = "trc20"
    CLASSIC_ASSET = "classic_asset"
