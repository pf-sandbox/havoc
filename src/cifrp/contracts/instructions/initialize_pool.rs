use anchor_lang::prelude::*;
use crate::state::CifrpPool;
use crate::constants::*;
use crate::errors::CifrpError;
use crate::events::PoolInitialized;

pub fn handler(
    ctx: Context<InitializePool>,
    token_mint: Pubkey,
    epoch_length_seconds: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    require!(epoch_length_seconds > 0, CifrpError::InvalidPoolConfig);

    pool.admin = ctx.accounts.admin.key();
    pool.token_mint = token_mint;
    pool.vault_sol = ctx.accounts.vault_sol.key();
    pool.total_accumulated = 0;
    pool.last_epoch_id = 0;
    pool.epoch_length_seconds = epoch_length_seconds;
    pool.paused = false;
    pool.fee_split_cifrp = FEE_SPLIT_CIFRP;
    pool.fee_split_creator = FEE_SPLIT_CREATOR;
    pool.fee_split_reserved = FEE_SPLIT_RESERVED;

    let total_split = pool.fee_split_cifrp as u32
        + pool.fee_split_creator as u32
        + pool.fee_split_reserved as u32;

    require_eq!(total_split, 100, CifrpError::InvalidFeeSplit);

    emit!(PoolInitialized {
        token_mint,
        admin: pool.admin,
        vault_sol: pool.vault_sol,
        epoch_length_seconds,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub admin: Signer<'info>,
    #[account(init, payer = payer, space = 8 + crate::state::CifrpPool::LEN)]
    pub pool: Account<'info, CifrpPool>,
    #[account(init, payer = payer, space = 0)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
