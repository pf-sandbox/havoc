use anchor_lang::prelude::*;
use crate::state::CifrpPool;
use crate::errors::CifrpError;
use crate::events::PoolUnpaused;

pub fn handler(ctx: Context<UnpausePool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require_keys_eq!(ctx.accounts.admin.key(), pool.admin, CifrpError::Unauthorized);
    require!(pool.paused, CifrpError::PoolPaused);
    pool.paused = false;
    emit!(PoolUnpaused {
        admin: ctx.accounts.admin.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UnpausePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, CifrpPool>,
}
