import { describe, it, expect, beforeEach } from '@jest/globals';
import { PublicKey } from '@solana/web3.js';
import { MerkleTree, hashUserLeaf } from '../merkle';
import { UserLeaf } from '../types';

describe('Merkle Tree', () => {
  let leaves: UserLeaf[];
  let tree: MerkleTree;

  beforeEach(() => {
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
        weight: BigInt(150),
        eligible: false,
      },
    ];

    tree = new MerkleTree(leaves);
  });

  it('should build tree from leaves', () => {
    expect(tree.getLeafCount()).toBe(3);
    expect(tree.getRootHash()).toBeDefined();
    expect(tree.getRootHash()).toHaveLength(32);
  });

  it('should generate valid merkle proofs', () => {
    const proof0 = tree.getProof(0);
    const proof1 = tree.getProof(1);
    const proof2 = tree.getProof(2);

    expect(proof0).toBeDefined();
    expect(proof1).toBeDefined();
    expect(proof2).toBeDefined();
  });

  it('should verify correct proofs', () => {
    const root = tree.getRootHash();
    const proof0 = tree.getProof(0);

    const verified = tree.verifyProof(leaves[0], proof0, root);
    expect(verified).toBe(true);
  });

  it('should reject invalid proofs', () => {
    const root = tree.getRootHash();
    const proof0 = tree.getProof(0);

    const modifiedLeaf: UserLeaf = {
      ...leaves[0],
      weight: BigInt(999),
    };

    const verified = tree.verifyProof(modifiedLeaf, proof0, root);
    expect(verified).toBe(false);
  });

  it('should hash user leaves consistently', () => {
    const hash1 = hashUserLeaf(leaves[0]);
    const hash2 = hashUserLeaf(leaves[0]);

    expect(hash1.equals(hash2)).toBe(true);
  });
});
