import { PublicKey } from '@solana/web3.js';

/**
 * CIFRP Type Definitions
 * Mirrors Anchor contract data structures for off-chain processing
 */

// ============================================================================
// CIFRP Pool
// ============================================================================

export interface CifrpPoolConfig {
  tokenMint: PublicKey;
  vaultSol: PublicKey; // PDA-owned SOL vault
  totalAccumulated: bigint;
  lastEpochId: bigint;
  epochLengthSeconds: bigint;
  paused: boolean;
  feeSplitCifrp: number; // 30 (percent)
  feeSplitCreator: number; // 50 (percent)
  feeSplitReserved: number; // 20 (percent)
}

export const CIFRP_CONSTANTS = {
  EPOCH_LENGTH_SECONDS: BigInt(6 * 60 * 60), // 6 hours
  MIN_POOL_DISTRIBUTION: BigInt(0.5e9), // 0.5 SOL in lamports
  MAX_EPOCH_CARRYOVER: BigInt('18446744073709551615'), // u64::MAX
} as const;

// ============================================================================
// Epoch Model
// ============================================================================

export interface EpochState {
  epochId: bigint;
  poolBalance: bigint; // lamports
  havocMerkleRoot: Buffer; // 32 bytes
  totalWeight: bigint; // u128 from Havoc
  claimedAmount: bigint;
  timestamp: number;
  finalized: boolean;
}

export function computeEpochId(blockTimestamp: number): bigint {
  const epochLengthSeconds = Number(CIFRP_CONSTANTS.EPOCH_LENGTH_SECONDS);
  return BigInt(Math.floor(blockTimestamp / epochLengthSeconds));
}

// ============================================================================
// Havoc Oracle
// ============================================================================

export interface HavocEpochSnapshot {
  epochId: bigint;
  merkleRoot: Buffer; // [u8; 32]
  totalWeight: bigint; // u128
  timestamp: number;
}

export interface UserLeaf {
  wallet: PublicKey;
  weight: bigint; // u128: normalized participation score
  eligible: boolean;
}

export interface UserLeafProof {
  leaf: UserLeaf;
  proof: Buffer[]; // Merkle proof array
  leafIndex: number;
}

// ============================================================================
// Claim Model
// ============================================================================

export interface ClaimRecord {
  epochId: bigint;
  wallet: PublicKey;
  claimed: boolean;
  rewardAmount: bigint;
  claimTimestamp: number;
}

export interface ClaimRequest {
  epochId: bigint;
  userLeaf: UserLeaf;
  merkleProof: Buffer[];
}

export interface ClaimResult {
  success: boolean;
  rewardAmount: bigint;
  error?: string;
}

// ============================================================================
// Fee Routing
// ============================================================================

export interface FeeAllocation {
  cifrpPoolAmount: bigint; // 30%
  creatorAmount: bigint; // 50%
  reservedAmount: bigint; // 20%
}

export interface FeeRouteEvent {
  tokenMint: PublicKey;
  totalFeeAmount: bigint;
  allocation: FeeAllocation;
  timestamp: number;
  txSignature: string;
}

// ============================================================================
// Reward Calculation
// ============================================================================

export interface RewardCalculation {
  epochPoolBalance: bigint;
  userWeight: bigint;
  totalWeight: bigint;
  computedReward: bigint;
  formula: string; // For audit trail
}

// ============================================================================
// Configuration & Admin
// ============================================================================

export interface AdminAction {
  type: 'PAUSE' | 'UNPAUSE' | 'REGISTER_SNAPSHOT' | 'EMERGENCY_HALT';
  timestamp: number;
  actor: PublicKey;
  details?: Record<string, unknown>;
}

// ============================================================================
// Storage Models (for off-chain state)
// ============================================================================

export interface StoredEpochState {
  epochId: bigint;
  poolBalance: bigint;
  havocMerkleRoot: string; // hex-encoded
  totalWeight: string; // bigint as string
  claimedAmount: bigint;
  timestamp: number;
  finalized: boolean;
}

export interface StoredClaimRecord {
  epochId: bigint;
  wallet: string; // base58 encoded
  claimed: boolean;
  rewardAmount: bigint;
  claimTimestamp: number;
}
