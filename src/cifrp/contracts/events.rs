use anchor_lang::prelude::*;

#[event]
pub struct PoolInitialized {
    pub token_mint: Pubkey,
    pub admin: Pubkey,
    pub vault_sol: Pubkey,
    pub epoch_length_seconds: u64,
}

#[event]
pub struct PoolPaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolUnpaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FeeDeposited {
    pub pool: Pubkey,
    pub amount: u64,
    pub total_accumulated: u64,
    pub timestamp: i64,
}

#[event]
pub struct EpochSnapshotRegistered {
    pub pool: Pubkey,
    pub epoch_id: u64,
    pub merkle_root: [u8; 32],
    pub total_weight: u128,
    pub pool_balance: u64,
    pub timestamp: i64,
}

#[event]
pub struct EpochFinalized {
    pub pool: Pubkey,
    pub epoch_id: u64,
    pub pool_balance: u64,
    pub claimed_amount: u64,
    pub dust: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardClaimed {
    pub pool: Pubkey,
    pub epoch_id: u64,
    pub user: Pubkey,
    pub reward_amount: u64,
    pub user_weight: u128,
    pub total_weight: u128,
    pub timestamp: i64,
}
