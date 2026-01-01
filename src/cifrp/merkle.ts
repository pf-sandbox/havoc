import crypto from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { UserLeaf } from './types';

/**
 * Merkle Tree implementation for CIFRP
 * Used for verifying eligibility and user weights from Havoc snapshots
 */

export class MerkleTree {
  private tree: Buffer[] = [];
  private leaves: UserLeaf[] = [];

  constructor(leaves: UserLeaf[] = []) {
    this.leaves = leaves;
    if (leaves.length > 0) {
      this.buildTree(leaves);
    }
  }

  /**
   * Build merkle tree from leaves
   */
  private buildTree(leaves: UserLeaf[]): void {
    if (leaves.length === 0) throw new Error('Cannot build tree with no leaves');

    let currentLevel = leaves.map((leaf) => this.hashLeaf(leaf));
    this.tree = [...currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel: Buffer[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || currentLevel[i];
        const parent = this.hashPair(left, right);
        nextLevel.push(parent);
      }
      currentLevel = nextLevel;
      this.tree.push(...currentLevel);
    }
  }

  /**
   * Hash a user leaf to get leaf hash
   */
  private hashLeaf(leaf: UserLeaf): Buffer {
    const data = Buffer.concat([
      leaf.wallet.toBuffer(), // 32 bytes
      this.bigintToBuffer(leaf.weight, 16), // 16 bytes for u128
      Buffer.from([leaf.eligible ? 1 : 0]), // 1 byte
    ]);
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Hash two nodes
   */
  private hashPair(left: Buffer, right: Buffer): Buffer {
    const data = Buffer.concat([left, right]);
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Convert bigint to fixed-size buffer (little-endian)
   */
  private bigintToBuffer(value: bigint, bytes: number): Buffer {
    const buffer = Buffer.alloc(bytes);
    for (let i = 0; i < bytes; i++) {
      buffer[i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
    }
    return buffer;
  }

  /**
   * Get the root hash of the tree
   */
  getRootHash(): Buffer {
    if (this.tree.length === 0) throw new Error('Tree is empty');
    return this.tree[this.tree.length - 1];
  }

  /**
   * Get merkle proof for a leaf at given index
   */
  getProof(leafIndex: number): Buffer[] {
    if (leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of bounds`);
    }

    const proof: Buffer[] = [];
    let currentIndex = leafIndex;
    let level = 0;

    const levelSizes = this.calculateLevelSizes(this.leaves.length);

    for (let levelSize of levelSizes) {
      const sibling = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const siblingInBounds = sibling < levelSize;

      if (siblingInBounds) {
        const treeIndex = this.getTreeIndex(level, sibling, levelSizes);
        if (treeIndex < this.tree.length) {
          proof.push(this.tree[treeIndex]);
        }
      }

      currentIndex = Math.floor(currentIndex / 2);
      level++;
    }

    return proof;
  }

  /**
   * Verify a merkle proof
   */
  verifyProof(leaf: UserLeaf, proof: Buffer[], root: Buffer): boolean {
    let currentHash = this.hashLeaf(leaf);

    for (const proofNode of proof) {
      currentHash = this.hashPair(currentHash, proofNode);
    }

    return currentHash.equals(root);
  }

  /**
   * Calculate sizes of each level in the tree
   */
  private calculateLevelSizes(leafCount: number): number[] {
    const sizes: number[] = [leafCount];
    let current = leafCount;

    while (current > 1) {
      current = Math.ceil(current / 2);
      sizes.push(current);
    }

    return sizes;
  }

  /**
   * Get the index in tree array for a node at level and position
   */
  private getTreeIndex(
    level: number,
    positionInLevel: number,
    levelSizes: number[]
  ): number {
    let index = 0;
    for (let i = 0; i < level; i++) {
      index += levelSizes[i];
    }
    return index + positionInLevel;
  }

  /**
   * Get leaves count
   */
  getLeafCount(): number {
    return this.leaves.length;
  }

  /**
   * Get all leaves
   */
  getLeaves(): UserLeaf[] {
    return [...this.leaves];
  }
}

/**
 * Verify a merkle proof (standalone function)
 */
export function verifyMerkleProof(
  leaf: UserLeaf,
  proof: Buffer[],
  root: Buffer
): boolean {
  const tree = new MerkleTree([leaf]);
  return tree.verifyProof(leaf, proof, root);
}

/**
 * Hash a user leaf (standalone)
 */
export function hashUserLeaf(leaf: UserLeaf): Buffer {
  const data = Buffer.concat([
    leaf.wallet.toBuffer(), // 32 bytes
    bigintToBuffer(leaf.weight, 16), // 16 bytes for u128
    Buffer.from([leaf.eligible ? 1 : 0]), // 1 byte
  ]);
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Convert bigint to fixed-size buffer (little-endian)
 */
function bigintToBuffer(value: bigint, bytes: number): Buffer {
  const buffer = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) {
    buffer[i] = Number((value >> BigInt(i * 8)) & BigInt(0xff));
  }
  return buffer;
}
