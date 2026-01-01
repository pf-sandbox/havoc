import { describe, it, expect } from '@jest/globals';
import {
  calculateReward,
  calculateRewardAmount,
  calculateDust,
  verifyClaimedAmounts,
} from '../reward-calculator';

describe('Reward Calculator', () => {
  describe('calculateReward', () => {
    it('should calculate reward correctly', () => {
      const result = calculateReward({
        epochPoolBalance: BigInt(1000000),
        userWeight: BigInt(100),
        totalWeight: BigInt(1000),
      });

      expect(result.computedReward).toBe(BigInt(100000));
    });

    it('should handle proportional weights', () => {
      const result = calculateReward({
        epochPoolBalance: BigInt(1000),
        userWeight: BigInt(100),
        totalWeight: BigInt(1000),
      });

      expect(result.computedReward).toBe(BigInt(100));
    });

    it('should throw on zero total weight', () => {
      expect(() => {
        calculateReward({
          epochPoolBalance: BigInt(1000000),
          userWeight: BigInt(100),
          totalWeight: BigInt(0),
        });
      }).toThrow('Cannot calculate reward with totalWeight = 0');
    });

    it('should throw if user weight exceeds total', () => {
      expect(() => {
        calculateReward({
          epochPoolBalance: BigInt(1000),
          userWeight: BigInt(2000),
          totalWeight: BigInt(1000),
        });
      }).toThrow('User weight cannot exceed total weight');
    });
  });

  describe('calculateDust', () => {
    it('should calculate unclaimed dust', () => {
      const dust = calculateDust(BigInt(1000), BigInt(999));
      expect(dust).toBe(BigInt(1));
    });

    it('should throw if allocated exceeds balance', () => {
      expect(() => {
        calculateDust(BigInt(1000), BigInt(1001));
      }).toThrow('Total allocated exceeds pool balance');
    });
  });

  describe('verifyClaimedAmounts', () => {
    it('should verify valid claimed amounts', () => {
      const result = verifyClaimedAmounts(
        [{ amount: BigInt(100) }, { amount: BigInt(200) }],
        BigInt(500)
      );

      expect(result.valid).toBe(true);
      expect(result.totalClaimed).toBe(BigInt(300));
      expect(result.dust).toBe(BigInt(200));
    });

    it('should reject claims exceeding balance', () => {
      const result = verifyClaimedAmounts([{ amount: BigInt(600) }], BigInt(500));

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
