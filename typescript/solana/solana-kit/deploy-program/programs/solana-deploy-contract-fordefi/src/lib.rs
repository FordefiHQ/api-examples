use anchor_lang::prelude::*;

declare_id!("Prg3PxfbGuo171knvrEwZ85SnNjciR3fsd7wo5JxN1u");

#[program]
pub mod solana_deploy_contract_fordefi {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("This program was deployed with Fordefi!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
