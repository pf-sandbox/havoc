use anchor_lang::prelude::*;
use crate::state::{CifrpPool, EpochState};
use crate::errors::CifrpError;
use crate::events::EpochFinalized;

pub fn handler(ctx: Context<FinalizeEpoch>, epoch_id: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let epoch_state = &mut ctx.accounts.epoch_state;

    require_keys_eq!(ctx.accounts.admin.key(), pool.admin, CifrpError::Unauthorized);
    require_eq!(epoch_state.epoch_id, epoch_id, CifrpError::EpochMismatch);
    require!(!epoch_state.finalized, CifrpError::EpochAlreadyFinalized);

    epoch_state.finalized = true;

    let dust = epoch_state.pool_balance.saturating_sub(epoch_state.claimed_amount);

    if epoch_id > pool.last_epoch_id {
        pool.last_epoch_id = epoch_id;
    }

    emit!(EpochFinalized {
        pool: pool.key(),
        epoch_id,
        pool_balance: epoch_state.pool_balance,
        claimed_amount: epoch_state.claimed_amount,
        dust,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct FinalizeEpoch<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub pool: Account<'info, CifrpPool>,
    #[account(mut)]
    pub epoch_state: Account<'info, EpochState>,
}
