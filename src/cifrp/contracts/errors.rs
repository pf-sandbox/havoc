use anchor_lang::prelude::*;

#[error_code]
pub enum CifrpError {
    #[msg("Pool is paused")]
    PoolPaused,
    #[msg("Unauthorized: admin required")]
    Unauthorized,
    #[msg("Epoch not found")]
    EpochNotFound,
    #[msg("Epoch not finalized")]
    EpochNotFinalized,
    #[msg("Epoch already finalized")]
    EpochAlreadyFinalized,
    #[msg("User not eligible")]
    UserIneligible,
    #[msg("Zero weight")]
    ZeroWeight,
    #[msg("Invalid merkle proof")]
    InvalidMerkleProof,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Zero reward")]
    ZeroReward,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Balance underflow")]
    BalanceUnderflow,
    #[msg("Zero total weight")]
    ZeroTotalWeight,
    #[msg("Invalid fee split")]
    InvalidFeeSplit,
    #[msg("Claim overflow")]
    ClaimOverflow,
    #[msg("Merkle proof too long")]
    MerkleProofTooLong,
    #[msg("Invalid config")]
    InvalidPoolConfig,
    #[msg("Snapshot missing")]
    SnapshotMissing,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Epoch mismatch")]
    EpochMismatch,
}
