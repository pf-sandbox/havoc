mod state;
mod instructions;
mod constants;
mod errors;
mod events;

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod cifrp {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        token_mint: Pubkey,
        epoch_length_seconds: u64,
    ) -> Result<()> {
        instructions::initialize_pool::handler(ctx, token_mint, epoch_length_seconds)
    }

    pub fn pause_pool(ctx: Context<PausePool>) -> Result<()> {
        instructions::pause_pool::handler(ctx)
    }

    pub fn unpause_pool(ctx: Context<UnpausePool>) -> Result<()> {
        instructions::unpause_pool::handler(ctx)
    }

    pub fn deposit_fee(ctx: Context<DepositFee>, amount: u64) -> Result<()> {
        instructions::deposit_fee::handler(ctx, amount)
    }

    pub fn register_epoch_snapshot(
        ctx: Context<RegisterEpochSnapshot>,
        epoch_id: u64,
        merkle_root: [u8; 32],
        total_weight: u128,
    ) -> Result<()> {
        instructions::register_epoch_snapshot::handler(ctx, epoch_id, merkle_root, total_weight)
    }

    pub fn finalize_epoch(ctx: Context<FinalizeEpoch>, epoch_id: u64) -> Result<()> {
        instructions::finalize_epoch::handler(ctx, epoch_id)
    }

    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        epoch_id: u64,
        user_weight: u128,
        eligible: bool,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim_reward::handler(ctx, epoch_id, user_weight, eligible, merkle_proof)
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub admin: Signer<'info>,
    #[account(init, payer = payer, space = 8 + std::mem::size_of::<state::CifrpPool>())]
    pub pool: Account<'info, state::CifrpPool>,
    #[account(init, payer = payer, space = 0)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PausePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, state::CifrpPool>,
}

#[derive(Accounts)]
pub struct UnpausePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, state::CifrpPool>,
}

#[derive(Accounts)]
pub struct DepositFee<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, state::CifrpPool>,
    #[account(mut)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterEpochSnapshot<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub pool: Account<'info, state::CifrpPool>,
    #[account(init_if_needed, payer = admin, space = 8 + std::mem::size_of::<state::EpochState>())]
    pub epoch_state: Account<'info, state::EpochState>,
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeEpoch<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub pool: Account<'info, state::CifrpPool>,
    #[account(mut)]
    pub epoch_state: Account<'info, state::EpochState>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub pool: Account<'info, state::CifrpPool>,
    #[account(constraint = epoch_state.finalized)]
    pub epoch_state: Account<'info, state::EpochState>,
    #[account(mut)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    #[account(init_if_needed, payer = user, space = 8 + std::mem::size_of::<state::ClaimRecord>(),
      seeds = [b"claim", epoch_state.epoch_id.to_le_bytes().as_ref(), user.key().as_ref()], bump)]
    pub claim_record: Account<'info, state::ClaimRecord>,
}
