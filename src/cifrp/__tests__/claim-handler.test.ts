import { describe, it, expect, beforeEach } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import { ClaimHandler } from '../claim-handler';
import { MerkleTree } from '../merkle';
import { UserLeaf } from '../types';

describe('Claim Handler', () => {
  let handler: ClaimHandler;
  let tree: MerkleTree;
  let leaves: UserLeaf[];
  let merkleRoot: Buffer;

  beforeEach(() => {
    handler = new ClaimHandler();

    leaves = [
      {
        wallet: new PublicKey('11111111111111111111111111111111'),
        weight: BigInt(100),
        eligible: true,
      },
      {
        wallet: new PublicKey('22222222222222222222222222222222'),
        weight: BigInt(200),
        eligible: true,
      },
      {
        wallet: new PublicKey('33333333333333333333333333333333'),
        weight: BigInt(0),
        eligible: false,
      },
    ];

    tree = new MerkleTree(leaves);
    merkleRoot = tree.getRootHash();
  });

  describe('validateClaim', () => {
    it('should validate correct claim', () => {
      const userLeaf = leaves[0];
      const proof = tree.getProof(0);

      const result = handler.validateClaim({
        epochId: BigInt(1),
        wallet: userLeaf.wallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(1000),
      });

      expect(result.valid).toBe(true);
    });

    it('should reject wallet mismatch', () => {
      const userLeaf = leaves[0];
      const proof = tree.getProof(0);
      const wrongWallet = new PublicKey('44444444444444444444444444444444');

      const result = handler.validateClaim({
        epochId: BigInt(1),
        wallet: wrongWallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(1000),
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WALLET_MISMATCH');
    });

    it('should reject ineligible users', () => {
      const userLeaf = leaves[2];
      const proof = tree.getProof(2);

      const result = handler.validateClaim({
        epochId: BigInt(1),
        wallet: userLeaf.wallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(1000),
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INELIGIBLE');
    });

    it('should reject zero reward', () => {
      const userLeaf = leaves[0];
      const proof = tree.getProof(0);

      const result = handler.validateClaim({
        epochId: BigInt(1),
        wallet: userLeaf.wallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(0),
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ZERO_REWARD');
    });

    it('should reject already claimed', () => {
      const userLeaf = leaves[0];
      const proof = tree.getProof(0);

      handler.validateClaim({
        epochId: BigInt(1),
        wallet: userLeaf.wallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(1000),
      });

      handler.recordClaim(BigInt(1), userLeaf.wallet, BigInt(1000));

      const result = handler.validateClaim({
        epochId: BigInt(1),
        wallet: userLeaf.wallet,
        userLeaf,
        merkleProof: proof,
        merkleRoot,
        rewardAmount: BigInt(1000),
      });

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ALREADY_CLAIMED');
    });
  });

  describe('recordClaim', () => {
    it('should record claim', () => {
      const wallet = leaves[0].wallet;
      const record = handler.recordClaim(BigInt(1), wallet, BigInt(1000));

      expect(record.epochId).toBe(BigInt(1));
      expect(record.wallet).toEqual(wallet);
      expect(record.claimed).toBe(true);
      expect(record.rewardAmount).toBe(BigInt(1000));
    });

    it('should throw on double claim', () => {
      const wallet = leaves[0].wallet;
      handler.recordClaim(BigInt(1), wallet, BigInt(1000));

      expect(() => {
        handler.recordClaim(BigInt(1), wallet, BigInt(1000));
      }).toThrow('Already claimed');
    });
  });

  describe('hasClaimed', () => {
    it('should detect claimed epochs', () => {
      const wallet = leaves[0].wallet;

      expect(handler.hasClaimed(BigInt(1), wallet)).toBe(false);

      handler.recordClaim(BigInt(1), wallet, BigInt(1000));

      expect(handler.hasClaimed(BigInt(1), wallet)).toBe(true);
    });
  });

  describe('getTotalClaimed', () => {
    it('should sum all claims for epoch', () => {
      handler.recordClaim(BigInt(1), leaves[0].wallet, BigInt(1000));
      handler.recordClaim(BigInt(1), leaves[1].wallet, BigInt(2000));

      const total = handler.getTotalClaimed(BigInt(1));

      expect(total).toBe(BigInt(3000));
    });
  });
});
