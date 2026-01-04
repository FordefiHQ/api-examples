use anchor_lang::prelude::*;

declare_id!("Prg1GzogBqdvQTx2fNBBcdVnRKUQYCWP73CcQrjYcr7");

#[program]
pub mod solana_deploy_contract_fordefi {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("This program was updated to version 2 with Fordefi!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
