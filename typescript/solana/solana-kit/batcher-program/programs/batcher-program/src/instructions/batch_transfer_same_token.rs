use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::MAX_TRANSFERS_SAME_TOKEN;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct BatchTransferSameToken<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mut, token::authority = sender)]
    pub sender_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler<'a>(ctx: Context<'a, BatchTransferSameToken<'a>>, amounts: Vec<u64>) -> Result<()> {
    require!(!amounts.is_empty(), ErrorCode::EmptyTransferList);
    require!(amounts.len() <= MAX_TRANSFERS_SAME_TOKEN, ErrorCode::MaxTransfersExceeded);
    require!(
        ctx.remaining_accounts.len() == amounts.len(),
        ErrorCode::AccountCountMismatch
    );

    let sender_mint = ctx.accounts.sender_token_account.mint;

    for (i, amount) in amounts.iter().enumerate() {
        let dest_account_info = &ctx.remaining_accounts[i];

        // Validate destination is a token account with matching mint
        let dest_data = dest_account_info.try_borrow_data()?;
        let dest_token_account =
            TokenAccount::try_deserialize(&mut dest_data.as_ref())
                .map_err(|_| ErrorCode::InvalidTokenAccount)?;
        require!(dest_token_account.mint == sender_mint, ErrorCode::MintMismatch);
        drop(dest_data);

        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: dest_account_info.clone(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            cpi_accounts,
        );
        token::transfer(cpi_ctx, *amount)?;
    }

    Ok(())
}
