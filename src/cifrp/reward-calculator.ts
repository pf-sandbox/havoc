import { RewardCalculation } from './types';

/**
 * Reward Calculation Module
 * Implements: user_reward = (epoch_pool_balance * user_weight) / havoc_total_weight
 * Uses checked arithmetic with floor rounding
 */

export interface RewardCalculationInput {
  epochPoolBalance: bigint;
  userWeight: bigint;
  totalWeight: bigint;
}

/**
 * Calculate reward for a user in an epoch
 * Formula: (epoch_pool_balance * user_weight) / havoc_total_weight
 *
 * @throws Error if totalWeight is 0, or if arithmetic fails
 */
export function calculateReward(input: RewardCalculationInput): RewardCalculation {
  const { epochPoolBalance, userWeight, totalWeight } = input;

  // Validation
  if (totalWeight === 0n) {
    throw new Error('Cannot calculate reward with totalWeight = 0');
  }

  if (userWeight < 0n || epochPoolBalance < 0n || totalWeight < 0n) {
    throw new Error('Negative values not allowed in reward calculation');
  }

  if (userWeight > totalWeight) {
    throw new Error('User weight cannot exceed total weight');
  }

  // Calculate: (epochPoolBalance * userWeight) / totalWeight
  // Using checked arithmetic
  const numerator = epochPoolBalance * userWeight;

  // Check for overflow (simplified check for practical purposes)
  if (numerator < 0n) {
    throw new Error('Arithmetic overflow in reward calculation');
  }

  // Integer division with floor rounding (default behavior in JS)
  const computedReward = numerator / totalWeight;

  return {
    epochPoolBalance,
    userWeight,
    totalWeight,
    computedReward,
    formula: `(${epochPoolBalance} * ${userWeight}) / ${totalWeight} = ${computedReward}`,
  };
}

/**
 * Calculate reward amount (without full calculation object)
 */
export function calculateRewardAmount(
  epochPoolBalance: bigint,
  userWeight: bigint,
  totalWeight: bigint
): bigint {
  const calc = calculateReward({
    epochPoolBalance,
    userWeight,
    totalWeight,
  });
  return calc.computedReward;
}

/**
 * Calculate dust (unclaimed due to rounding)
 * This is the difference between pool balance and sum of all rewards
 */
export function calculateDust(
  epochPoolBalance: bigint,
  totalAllocated: bigint
): bigint {
  if (totalAllocated > epochPoolBalance) {
    throw new Error(
      `Total allocated ${totalAllocated} exceeds pool balance ${epochPoolBalance}`
    );
  }

  return epochPoolBalance - totalAllocated;
}

/**
 * Calculate proportion of user's weight relative to total
 * Returns as fixed-point number (scaled by 10^9 for precision)
 */
export function calculateUserProportion(
  userWeight: bigint,
  totalWeight: bigint
): bigint {
  if (totalWeight === 0n) {
    throw new Error('Cannot calculate proportion with totalWeight = 0');
  }

  const SCALE = BigInt(1e9);
  return (userWeight * SCALE) / totalWeight;
}

/**
 * Verify all claimed amounts sum correctly
 */
export function verifyClaimedAmounts(
  claims: Array<{ amount: bigint }>,
  epochPoolBalance: bigint
): {
  valid: boolean;
  totalClaimed: bigint;
  dust: bigint;
  error?: string;
} {
  const totalClaimed = claims.reduce((sum, claim) => sum + claim.amount, 0n);
  const dust = epochPoolBalance - totalClaimed;

  if (totalClaimed > epochPoolBalance) {
    return {
      valid: false,
      totalClaimed,
      dust,
      error: `Claims exceed pool balance: claimed=${totalClaimed}, balance=${epochPoolBalance}`,
    };
  }

  return {
    valid: true,
    totalClaimed,
    dust,
  };
}

/**
 * Batch calculate rewards for multiple users
 */
export function batchCalculateRewards(
  epochPoolBalance: bigint,
  users: Array<{ wallet: string; weight: bigint }>,
  totalWeight: bigint
): Array<{
  wallet: string;
  reward: bigint;
  proportion: bigint;
}> {
  if (users.length === 0) {
    return [];
  }

  return users.map(({ wallet, weight }) => {
    const reward = calculateRewardAmount(epochPoolBalance, weight, totalWeight);
    const proportion = calculateUserProportion(weight, totalWeight);

    return {
      wallet,
      reward,
      proportion,
    };
  });
}

/**
 * Calculate total rewards across all eligible users
 */
export function calculateTotalRewards(
  epochPoolBalance: bigint,
  users: Array<{ weight: bigint }>,
  totalWeight: bigint
): bigint {
  let total = 0n;

  for (const user of users) {
    const reward = calculateRewardAmount(epochPoolBalance, user.weight, totalWeight);
    total = total + reward;
  }

  return total;
}
