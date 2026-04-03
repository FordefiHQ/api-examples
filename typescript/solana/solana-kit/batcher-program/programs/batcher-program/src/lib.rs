pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;

declare_id!("BTCH6Wx6XdS8epLM4qZtuLeUebvBCzVPS4WAcQgPQw6t");

#[program]
pub mod batcher_program {
    use super::*;

    pub fn batch_transfer_same_token<'a>(
        ctx: Context<'a, BatchTransferSameToken<'a>>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        instructions::batch_transfer_same_token::handler(ctx, amounts)
    }

    pub fn batch_transfer_multi_token<'a>(
        ctx: Context<'a, BatchTransferMultiToken<'a>>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        instructions::batch_transfer_multi_token::handler(ctx, amounts)
    }
}
