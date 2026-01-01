import { describe, it, expect, beforeEach } from '@jest/globals';
import { EpochManager } from '../epoch-manager';

describe('Epoch Manager', () => {
  let manager: EpochManager;

  beforeEach(() => {
    manager = new EpochManager();
  });

  describe('getCurrentEpochId', () => {
    it('should compute correct epoch ID', () => {
      const blockTimestamp = 0;
      const epochId = EpochManager.getCurrentEpochId(blockTimestamp);
      expect(epochId).toBe(BigInt(0));
    });

    it('should increment epoch ID every 6 hours', () => {
      const sixHours = 6 * 60 * 60;
      const epochId0 = EpochManager.getCurrentEpochId(0);
      const epochId1 = EpochManager.getCurrentEpochId(sixHours);

      expect(epochId1).toBe(epochId0 + 1n);
    });
  });

  describe('initializeEpoch', () => {
    it('should initialize epoch state', () => {
      const merkleRoot = Buffer.alloc(32);
      const epoch = manager.initializeEpoch(
        BigInt(1),
        BigInt(1000000),
        merkleRoot,
        BigInt(1000)
      );

      expect(epoch.epochId).toBe(BigInt(1));
      expect(epoch.poolBalance).toBe(BigInt(1000000));
      expect(epoch.totalWeight).toBe(BigInt(1000));
      expect(epoch.finalized).toBe(false);
    });

    it('should throw on duplicate epoch', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));

      expect(() => {
        manager.initializeEpoch(BigInt(1), BigInt(2000000), merkleRoot, BigInt(2000));
      }).toThrow('already initialized');
    });
  });

  describe('shouldSkipEpoch', () => {
    it('should skip low balance epochs', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(100000000), merkleRoot, BigInt(1000));

      expect(manager.shouldSkipEpoch(BigInt(1))).toBe(true);
    });

    it('should not skip sufficient balance epochs', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000000), merkleRoot, BigInt(1000));

      expect(manager.shouldSkipEpoch(BigInt(1))).toBe(false);
    });
  });

  describe('finalizeEpoch', () => {
    it('should finalize epoch', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));

      manager.finalizeEpoch(BigInt(1));

      const epoch = manager.getEpoch(BigInt(1));
      expect(epoch?.finalized).toBe(true);
    });

    it('should throw on double finalize', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));
      manager.finalizeEpoch(BigInt(1));

      expect(() => {
        manager.finalizeEpoch(BigInt(1));
      }).toThrow('already finalized');
    });
  });

  describe('recordClaim', () => {
    it('should record claim against epoch', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));

      manager.recordClaim(BigInt(1), BigInt(100000));

      const epoch = manager.getEpoch(BigInt(1));
      expect(epoch?.claimedAmount).toBe(BigInt(100000));
    });

    it('should throw if claim exceeds balance', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(100000), merkleRoot, BigInt(1000));

      expect(() => {
        manager.recordClaim(BigInt(1), BigInt(200000));
      }).toThrow('exceed pool balance');
    });
  });

  describe('getDust', () => {
    it('should return dust amount', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));
      manager.recordClaim(BigInt(1), BigInt(999999));

      const dust = manager.getDust(BigInt(1));
      expect(dust).toBe(BigInt(1));
    });
  });

  describe('rolloverDust', () => {
    it('should rollover dust to next epoch', () => {
      const merkleRoot = Buffer.alloc(32);
      manager.initializeEpoch(BigInt(1), BigInt(1000000), merkleRoot, BigInt(1000));
      manager.initializeEpoch(BigInt(2), BigInt(500000), merkleRoot, BigInt(1000));

      manager.recordClaim(BigInt(1), BigInt(999999));
      const rolledOver = manager.rolloverDust(BigInt(1), BigInt(2));

      expect(rolledOver).toBe(BigInt(1));
      const epoch2 = manager.getEpoch(BigInt(2));
      expect(epoch2?.poolBalance).toBe(BigInt(500001));
    });
  });
});
