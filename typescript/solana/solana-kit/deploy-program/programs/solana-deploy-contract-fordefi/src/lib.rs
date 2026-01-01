use anchor_lang::prelude::*;

declare_id!("9Weyw3FD5WuXdXMcMMiCRusTQwNLZaMeWQPBKBpFFjwa");

#[program]
pub mod solana_deploy_contract_fordefi {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from Fordefi! {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
