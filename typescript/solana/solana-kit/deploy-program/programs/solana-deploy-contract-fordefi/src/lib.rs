use anchor_lang::prelude::*;

declare_id!("PrgNpJSDC11uEMRjW7iVT1gYDPBCq3ocbVFt6GTZF2E");

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
