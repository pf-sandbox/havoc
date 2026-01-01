use anchor_lang::prelude::*;
use crate::state::{CifrpPool, EpochState, ClaimRecord, UserLeaf};
use crate::errors::CifrpError;
use crate::events::RewardClaimed;
use crate::constants::MAX_MERKLE_PROOF_DEPTH;

pub fn handler(
    ctx: Context<ClaimReward>,
    epoch_id: u64,
    user_weight: u128,
    eligible: bool,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let epoch_state = &ctx.accounts.epoch_state;
    let claim_record = &mut ctx.accounts.claim_record;

    require!(!pool.paused, CifrpError::PoolPaused);
    require_eq!(epoch_state.epoch_id, epoch_id, CifrpError::EpochMismatch);
    require!(epoch_state.finalized, CifrpError::EpochNotFinalized);
    require!(eligible, CifrpError::UserIneligible);
    require!(user_weight > 0, CifrpError::ZeroWeight);
    require!(epoch_state.total_weight > 0, CifrpError::ZeroTotalWeight);

    verify_merkle_proof(
        &ctx.accounts.user.key(),
        user_weight,
        eligible,
        &merkle_proof,
        &epoch_state.havoc_merkle_root,
    )?;

    let numerator = (epoch_state.pool_balance as u128)
        .checked_mul(user_weight)
        .ok_or(CifrpError::ArithmeticError)?;

    let reward_amount = (numerator / epoch_state.total_weight) as u64;

    require!(reward_amount > 0, CifrpError::ZeroReward);
    require!(!claim_record.claimed, CifrpError::AlreadyClaimed);

    let remaining = epoch_state.pool_balance.saturating_sub(epoch_state.claimed_amount);
    require!(reward_amount <= remaining, CifrpError::InsufficientBalance);

    claim_record.epoch_id = epoch_id;
    claim_record.wallet = ctx.accounts.user.key();
    claim_record.claimed = true;
    claim_record.reward_amount = reward_amount;
    claim_record.claim_timestamp = Clock::get()?.unix_timestamp;

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.vault_sol.key(),
        &ctx.accounts.user.key(),
        reward_amount,
    );

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.vault_sol.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    emit!(RewardClaimed {
        pool: pool.key(),
        epoch_id,
        user: ctx.accounts.user.key(),
        reward_amount,
        user_weight,
        total_weight: epoch_state.total_weight,
        timestamp: claim_record.claim_timestamp,
    });

    Ok(())
}

fn verify_merkle_proof(
    wallet: &Pubkey,
    weight: u128,
    eligible: bool,
    proof: &[[u8; 32]],
    root: &[u8; 32],
) -> Result<()> {
    require!(
        proof.len() <= MAX_MERKLE_PROOF_DEPTH,
        CifrpError::MerkleProofTooLong
    );

    let user_leaf = UserLeaf {
        wallet: *wallet,
        weight,
        eligible,
    };

    let mut current_hash = user_leaf.hash();

    for proof_node in proof {
        current_hash = hash_pair(&current_hash, proof_node);
    }

    require_eq!(current_hash, *root, CifrpError::InvalidMerkleProof);

    Ok(())
}

fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(left);
    hasher.update(right);
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub pool: Account<'info, CifrpPool>,
    #[account(constraint = epoch_state.finalized)]
    pub epoch_state: Account<'info, EpochState>,
    #[account(mut)]
    pub vault_sol: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + crate::state::ClaimRecord::LEN,
        seeds = [
            b"claim",
            epoch_state.epoch_id.to_le_bytes().as_ref(),
            user.key().as_ref(),
        ],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,
}
