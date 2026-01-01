use anchor_lang::prelude::*;

#[account]
pub struct CifrpPool {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub vault_sol: Pubkey,
    pub total_accumulated: u64,
    pub last_epoch_id: u64,
    pub epoch_length_seconds: u64,
    pub paused: bool,
    pub fee_split_cifrp: u8,
    pub fee_split_creator: u8,
    pub fee_split_reserved: u8,
    pub bump: u8,
}

impl CifrpPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 1;
}

#[account]
pub struct EpochState {
    pub epoch_id: u64,
    pub pool_balance: u64,
    pub havoc_merkle_root: [u8; 32],
    pub total_weight: u128,
    pub claimed_amount: u64,
    pub timestamp: i64,
    pub finalized: bool,
}

impl EpochState {
    pub const LEN: usize = 8 + 8 + 8 + 32 + 16 + 8 + 8 + 1;
}

#[account]
pub struct ClaimRecord {
    pub epoch_id: u64,
    pub wallet: Pubkey,
    pub claimed: bool,
    pub reward_amount: u64,
    pub claim_timestamp: i64,
}

impl ClaimRecord {
    pub const LEN: usize = 8 + 8 + 32 + 1 + 8 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct UserLeaf {
    pub wallet: Pubkey,
    pub weight: u128,
    pub eligible: bool,
}

impl UserLeaf {
    pub const LEN: usize = 32 + 16 + 1;

    pub fn hash(&self) -> [u8; 32] {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(&self.wallet.to_bytes());
        hasher.update(&self.weight.to_le_bytes());
        hasher.update(&[if self.eligible { 1 } else { 0 }]);
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct HavocEpochSnapshot {
    pub epoch_id: u64,
    pub merkle_root: [u8; 32],
    pub total_weight: u128,
}
