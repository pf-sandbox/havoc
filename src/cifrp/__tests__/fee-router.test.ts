import { describe, it, expect } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import { allocateFee, createFeeRouteEvent, validateFeeRouteEvent, FeeRouterState } from '../fee-router';

describe('Fee Router', () => {
  const tokenMint = new PublicKey('11111111111111111111111111111111');
  const vaultSol = new PublicKey('22222222222222222222222222222222');

  describe('allocateFee', () => {
    it('should split fees correctly', () => {
      const totalFee = BigInt(1000000);
      const allocation = allocateFee(totalFee);

      expect(allocation.cifrpPoolAmount).toBe(BigInt(300000));
      expect(allocation.creatorAmount).toBe(BigInt(500000));
      expect(allocation.reservedAmount).toBe(BigInt(200000));
    });

    it('should handle odd amounts with floor rounding', () => {
      const totalFee = BigInt(1000001);
      const allocation = allocateFee(totalFee);

      const sum = allocation.cifrpPoolAmount + allocation.creatorAmount + allocation.reservedAmount;
      expect(sum).toBeLessThanOrEqual(totalFee);
    });

    it('should throw on invalid fee split config', () => {
      expect(() => {
        allocateFee(BigInt(1000), {
          cifrpPercentage: 30,
          creatorPercentage: 40,
          reservedPercentage: 30,
        });
      }).toThrow('Fee split percentages must sum to 100');
    });
  });

  describe('FeeRouterState', () => {
    it('should initialize with zero balance', () => {
      const router = new FeeRouterState(tokenMint, vaultSol);
      expect(router.getAccumulatedBalance()).toBe(0n);
    });

    it('should process fees correctly', () => {
      const router = new FeeRouterState(tokenMint, vaultSol);
      router.processFee(BigInt(1000000), 'tx1');

      expect(router.getAccumulatedBalance()).toBe(BigInt(300000));
    });

    it('should accumulate multiple fees', () => {
      const router = new FeeRouterState(tokenMint, vaultSol);
      router.processFee(BigInt(1000000), 'tx1');
      router.processFee(BigInt(1000000), 'tx2');

      expect(router.getAccumulatedBalance()).toBe(BigInt(600000));
    });

    it('should withdraw accumulated balance', () => {
      const router = new FeeRouterState(tokenMint, vaultSol);
      router.processFee(BigInt(1000000), 'tx1');

      const withdrawn = router.withdrawBalance(BigInt(100000));

      expect(withdrawn).toBe(BigInt(100000));
      expect(router.getAccumulatedBalance()).toBe(BigInt(200000));
    });
  });
});
