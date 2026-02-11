from enum import Enum


class TransactionType(Enum):
    UTXO_TRANSACTION = "utxo_transaction"
    EVM_TRANSACTION = "evm_transaction"
    EVM_MESSAGE = "evm_message"
    SOLANA_TRANSACTION = "solana_transaction"
    EXCHANGE_TRANSACTION = "exchange_transaction"
    COSMOS_TRANSACTION = "cosmos_transaction"
    APTOS_TRANSACTION = "aptos_transaction"
    SUI_TRANSACTION = "sui_transaction"
    TON_TRANSACTION = "ton_transaction"
    TRON_TRANSACTION = "tron_transaction"


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


class TonTransactionDetailType(Enum):
    TON_TRANSFER = "ton_transfer"


class TronTransactionDetailType(Enum):
    TRON_TRANSFER = "tron_transfer"


class ExchangeTransactionDetailType(Enum):
    EXTERNAL_WITHDRAW = "external_withdraw"


# Asset identifier types

class AssetIdentifierType(Enum):
    SOLANA = "solana"
    EVM = "evm"
    COSMOS = "cosmos"
    APTOS = "aptos"
    SUI = "sui"
    TON = "ton"
    TRON = "tron"
    UTXO = "utxo"


class AssetDetailType(Enum):
    NATIVE = "native"
    ERC20 = "erc20"
    JETTON = "jetton"
    NEW_COIN = "new_coin"
    SPL_TOKEN = "spl_token"
    COIN = "coin"
    TRC20 = "trc20"
