use anchor_lang::prelude::*;
use crate::state::{CifrpPool, EpochState};
use crate::errors::CifrpError;
use crate::events::EpochSnapshotRegistered;

pub fn handler(
    ctx: Context<RegisterEpochSnapshot>,
    epoch_id: u64,
    merkle_root: [u8; 32],
    total_weight: u128,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let epoch_state = &mut ctx.accounts.epoch_state;

    require_keys_eq!(ctx.accounts.admin.key(), pool.admin, CifrpError::Unauthorized);
    require!(!pool.paused, CifrpError::PoolPaused);
    require!(total_weight > 0, CifrpError::ZeroTotalWeight);

    let vault_balance = ctx.accounts.vault_sol.to_account_info().lamports();

    epoch_state.epoch_id = epoch_id;
    epoch_state.pool_balance = vault_balance;
    epoch_state.havoc_merkle_root = merkle_root;
    epoch_state.total_weight = total_weight;
    epoch_state.claimed_amount = 0;
    epoch_state.timestamp = Clock::get()?.unix_timestamp;
    epoch_state.finalized = false;

    emit!(EpochSnapshotRegistered {
        pool: pool.key(),
        epoch_id,
        merkle_root,
        total_weight,
        pool_balance: vault_balance,
        timestamp: epoch_state.timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterEpochSnapshot<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub pool: Account<'info, CifrpPool>,
    #[account(init_if_needed, payer = admin, space = 8 + crate::state::EpochState::LEN)]
    pub epoch_state: Account<'info, EpochState>,
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}
