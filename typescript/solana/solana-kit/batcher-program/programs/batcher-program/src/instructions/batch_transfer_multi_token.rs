use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::constants::MAX_TRANSFERS_MULTI_TOKEN;
use crate::error::ErrorCode;

const VALID_TOKEN_PROGRAMS: [Pubkey; 2] = [
    anchor_spl::token::ID,
    anchor_spl::token_2022::ID,
];

#[derive(Accounts)]
pub struct BatchTransferMultiToken<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
}

/// Remaining accounts: [source_ata, dest_ata, mint, token_program] per transfer (quadruplets).
/// Each transfer can use a different mint and token program (Token or Token-2022).
pub fn handler<'a>(ctx: Context<'a, BatchTransferMultiToken<'a>>, amounts: Vec<u64>) -> Result<()> {
    require!(!amounts.is_empty(), ErrorCode::EmptyTransferList);
    require!(amounts.len() <= MAX_TRANSFERS_MULTI_TOKEN, ErrorCode::MaxTransfersExceeded);
    require!(
        ctx.remaining_accounts.len() == amounts.len() * 4,
        ErrorCode::AccountCountMismatch
    );

    let sender_key = ctx.accounts.sender.key();

    for (i, amount) in amounts.iter().enumerate() {
        let source_account_info = &ctx.remaining_accounts[4 * i];
        let dest_account_info = &ctx.remaining_accounts[4 * i + 1];
        let mint_account_info = &ctx.remaining_accounts[4 * i + 2];
        let token_program_info = &ctx.remaining_accounts[4 * i + 3];

        // Validate token program is Token or Token-2022
        require!(
            VALID_TOKEN_PROGRAMS.contains(&token_program_info.key()),
            ErrorCode::InvalidTokenProgram
        );

        // Validate source token account belongs to sender
        let source_data = source_account_info.try_borrow_data()?;
        let source_token_account =
            TokenAccount::try_deserialize(&mut source_data.as_ref())
                .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(source_token_account.owner == sender_key, ErrorCode::InvalidTokenAccount);
        let source_mint = source_token_account.mint;
        drop(source_data);

        // Validate mint account matches source token account's mint
        require!(mint_account_info.key() == source_mint, ErrorCode::MintMismatch);

        // Validate destination has matching mint
        let dest_data = dest_account_info.try_borrow_data()?;
        let dest_token_account =
            TokenAccount::try_deserialize(&mut dest_data.as_ref())
                .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(dest_token_account.mint == source_mint, ErrorCode::MintMismatch);
        drop(dest_data);

        // Read mint decimals
        let mint_data = mint_account_info.try_borrow_data()?;
        let mint_account =
            Mint::try_deserialize(&mut mint_data.as_ref())
                .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        let decimals = mint_account.decimals;
        drop(mint_data);

        let cpi_accounts = TransferChecked {
            from: source_account_info.clone(),
            to: dest_account_info.clone(),
            mint: mint_account_info.clone(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            token_program_info.key(),
            cpi_accounts,
        );
        token_interface::transfer_checked(cpi_ctx, *amount, decimals)?;
    }

    Ok(())
}
