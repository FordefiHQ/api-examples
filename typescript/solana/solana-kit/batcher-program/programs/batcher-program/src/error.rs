use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Transfer list is empty")]
    EmptyTransferList,

    #[msg("Number of remaining accounts does not match the number of transfers")]
    AccountCountMismatch,

    #[msg("A provided account is not a valid SPL token account")]
    InvalidTokenAccount,

    #[msg("Destination token account mint does not match source mint")]
    MintMismatch,

    #[msg("Total transfer amount overflows u64")]
    ArithmeticOverflow,

    #[msg("Exceeds maximum number of transfers per batch")]
    MaxTransfersExceeded,

    #[msg("Invalid token program: must be Token or Token-2022")]
    InvalidTokenProgram,
}
