import { PublicKey } from '@solana/web3.js';
import { FeeAllocation, FeeRouteEvent, CIFRP_CONSTANTS } from './types';

/**
 * Fee Routing Module
 * Implements the fee split logic for CIFRP
 * Immutable post-launch: 30% CIFRP, 50% Creator, 20% Reserved
 */

export interface FeeRouterConfig {
  cifrpPercentage: number; // 30
  creatorPercentage: number; // 50
  reservedPercentage: number; // 20
}

const DEFAULT_FEE_SPLIT: FeeRouterConfig = {
  cifrpPercentage: 30,
  creatorPercentage: 50,
  reservedPercentage: 20,
};

/**
 * Validate that percentages sum to 100
 */
function validateFeeSplit(config: FeeRouterConfig): void {
  const total = config.cifrpPercentage + config.creatorPercentage + config.reservedPercentage;
  if (total !== 100) {
    throw new Error(
      `Fee split percentages must sum to 100, got ${total}: CIFRP=${config.cifrpPercentage}, Creator=${config.creatorPercentage}, Reserved=${config.reservedPercentage}`
    );
  }
}

/**
 * Calculate fee allocation for a transaction
 * Uses checked arithmetic to prevent overflow/underflow
 */
export function allocateFee(
  totalFeeAmount: bigint,
  config: FeeRouterConfig = DEFAULT_FEE_SPLIT
): FeeAllocation {
  validateFeeSplit(config);

  // Use BigInt for precision, then convert back
  const cifrpAmount = (totalFeeAmount * BigInt(config.cifrpPercentage)) / BigInt(100);
  const creatorAmount = (totalFeeAmount * BigInt(config.creatorPercentage)) / BigInt(100);
  const reservedAmount = (totalFeeAmount * BigInt(config.reservedPercentage)) / BigInt(100);

  // Verify allocation
  const allocated = cifrpAmount + creatorAmount + reservedAmount;
  if (allocated > totalFeeAmount) {
    throw new Error(
      `Fee allocation overflow: allocated=${allocated}, total=${totalFeeAmount}`
    );
  }

  return {
    cifrpPoolAmount: cifrpAmount,
    creatorAmount: creatorAmount,
    reservedAmount: reservedAmount,
  };
}

/**
 * Create a fee route event for audit trail
 */
export function createFeeRouteEvent(
  tokenMint: PublicKey,
  totalFeeAmount: bigint,
  allocation: FeeAllocation,
  txSignature: string
): FeeRouteEvent {
  return {
    tokenMint,
    totalFeeAmount,
    allocation,
    timestamp: Math.floor(Date.now() / 1000),
    txSignature,
  };
}

/**
 * Validate a fee route event
 */
export function validateFeeRouteEvent(event: FeeRouteEvent): void {
  const { totalFeeAmount, allocation } = event;

  // Check allocation doesn't exceed total
  const allocated = allocation.cifrpPoolAmount + allocation.creatorAmount + allocation.reservedAmount;
  if (allocated > totalFeeAmount) {
    throw new Error(
      `Invalid fee allocation: allocated=${allocated}, total=${totalFeeAmount}`
    );
  }

  // Check no negative amounts
  if (allocation.cifrpPoolAmount < 0n || allocation.creatorAmount < 0n || allocation.reservedAmount < 0n) {
    throw new Error('Fee allocation contains negative amounts');
  }

  // Verify percentages are correct
  const cifrpPct = Number((allocation.cifrpPoolAmount * BigInt(100)) / totalFeeAmount);
  const creatorPct = Number((allocation.creatorAmount * BigInt(100)) / totalFeeAmount);
  const reservedPct = Number((allocation.reservedAmount * BigInt(100)) / totalFeeAmount);

  if (cifrpPct !== 30 || creatorPct !== 50 || reservedPct !== 20) {
    throw new Error(
      `Invalid fee percentages: CIFRP=${cifrpPct}%, Creator=${creatorPct}%, Reserved=${reservedPct}%`
    );
  }
}

/**
 * Fee router state for managing accumulated fees
 */
export class FeeRouterState {
  private tokenMint: PublicKey;
  private vaultSol: PublicKey;
  private totalAccumulated: bigint = 0n;
  private lastProcessedTx: string = '';
  private config: FeeRouterConfig;

  constructor(
    tokenMint: PublicKey,
    vaultSol: PublicKey,
    config: FeeRouterConfig = DEFAULT_FEE_SPLIT
  ) {
    validateFeeSplit(config);
    this.tokenMint = tokenMint;
    this.vaultSol = vaultSol;
    this.config = config;
  }

  /**
   * Process an incoming fee
   */
  processFee(feeAmount: bigint, txSignature: string): FeeAllocation {
    if (feeAmount <= 0n) {
      throw new Error('Fee amount must be positive');
    }

    const allocation = allocateFee(feeAmount, this.config);

    // Update accumulated total
    this.totalAccumulated = this.totalAccumulated + allocation.cifrpPoolAmount;
    this.lastProcessedTx = txSignature;

    return allocation;
  }

  /**
   * Get current accumulated balance
   */
  getAccumulatedBalance(): bigint {
    return this.totalAccumulated;
  }

  /**
   * Withdraw accumulated fees (for epoch distribution)
   */
  withdrawBalance(amount: bigint): bigint {
    if (amount > this.totalAccumulated) {
      throw new Error(
        `Withdrawal amount ${amount} exceeds accumulated balance ${this.totalAccumulated}`
      );
    }

    this.totalAccumulated = this.totalAccumulated - amount;
    return amount;
  }

  /**
   * Get config
   */
  getConfig(): FeeRouterConfig {
    return { ...this.config };
  }

  /**
   * Get state for persistence
   */
  getState() {
    return {
      tokenMint: this.tokenMint.toString(),
      vaultSol: this.vaultSol.toString(),
      totalAccumulated: this.totalAccumulated.toString(),
      lastProcessedTx: this.lastProcessedTx,
    };
  }

  /**
   * Restore from persisted state
   */
  static fromState(
    state: {
      tokenMint: string;
      vaultSol: string;
      totalAccumulated: string;
      lastProcessedTx: string;
    },
    config: FeeRouterConfig = DEFAULT_FEE_SPLIT
  ): FeeRouterState {
    const router = new FeeRouterState(
      new PublicKey(state.tokenMint),
      new PublicKey(state.vaultSol),
      config
    );
    router.totalAccumulated = BigInt(state.totalAccumulated);
    router.lastProcessedTx = state.lastProcessedTx;
    return router;
  }
}
