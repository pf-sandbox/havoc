import { PublicKey } from '@solana/web3.js';
import { ClaimRecord, UserLeaf } from './types';
import { verifyMerkleProof } from './merkle';

/**
 * Claim Handler - manages claim validation, deduplication, and processing
 */

export interface ClaimValidationInput {
  epochId: bigint;
  wallet: PublicKey;
  userLeaf: UserLeaf;
  merkleProof: Buffer[];
  merkleRoot: Buffer;
  rewardAmount: bigint;
}

export interface ClaimValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export class ClaimHandler {
  private claimRecords: Map<string, ClaimRecord[]> = new Map();
  private totalClaimedPerEpoch: Map<bigint, bigint> = new Map();

  private static generateClaimKey(epochId: bigint, wallet: PublicKey): string {
    return `${epochId}:${wallet.toString()}`;
  }

  validateClaim(input: ClaimValidationInput): ClaimValidationResult {
    const { epochId, wallet, userLeaf, merkleProof, merkleRoot, rewardAmount } = input;

    if (!wallet.equals(userLeaf.wallet)) {
      return { valid: false, error: 'Wallet mismatch', errorCode: 'WALLET_MISMATCH' };
    }

    if (!userLeaf.eligible) {
      return { valid: false, error: 'User not eligible', errorCode: 'INELIGIBLE' };
    }

    if (userLeaf.weight === 0n) {
      return { valid: false, error: 'User weight is zero', errorCode: 'ZERO_WEIGHT' };
    }

    try {
      const proofValid = verifyMerkleProof(userLeaf, merkleProof, merkleRoot);
      if (!proofValid) {
        return { valid: false, error: 'Invalid merkle proof', errorCode: 'INVALID_PROOF' };
      }
    } catch (err) {
      return { valid: false, error: `Proof error: ${err}`, errorCode: 'PROOF_ERROR' };
    }

    if (rewardAmount <= 0n) {
      return { valid: false, error: 'Reward not positive', errorCode: 'ZERO_REWARD' };
    }

    const claimKey = ClaimHandler.generateClaimKey(epochId, wallet);
    if (this.hasClaimedEpoch(claimKey)) {
      return { valid: false, error: 'Already claimed', errorCode: 'ALREADY_CLAIMED' };
    }

    return { valid: true };
  }

  recordClaim(epochId: bigint, wallet: PublicKey, rewardAmount: bigint): ClaimRecord {
    const claimKey = ClaimHandler.generateClaimKey(epochId, wallet);

    if (this.hasClaimedEpoch(claimKey)) {
      throw new Error(`Already claimed: ${claimKey}`);
    }

    const record: ClaimRecord = {
      epochId,
      wallet,
      claimed: true,
      rewardAmount,
      claimTimestamp: Math.floor(Date.now() / 1000),
    };

    if (!this.claimRecords.has(claimKey)) {
      this.claimRecords.set(claimKey, []);
    }

    this.claimRecords.get(claimKey)!.push(record);

    const currentTotal = this.totalClaimedPerEpoch.get(epochId) || 0n;
    this.totalClaimedPerEpoch.set(epochId, currentTotal + rewardAmount);

    return record;
  }

  hasClaimed(epochId: bigint, wallet: PublicKey): boolean {
    const claimKey = ClaimHandler.generateClaimKey(epochId, wallet);
    return this.hasClaimedEpoch(claimKey);
  }

  private hasClaimedEpoch(claimKey: string): boolean {
    const records = this.claimRecords.get(claimKey);
    return records !== undefined && records.length > 0 && records[0].claimed === true;
  }

  getClaimRecord(epochId: bigint, wallet: PublicKey): ClaimRecord | undefined {
    const claimKey = ClaimHandler.generateClaimKey(epochId, wallet);
    const records = this.claimRecords.get(claimKey);
    return records ? records[0] : undefined;
  }

  getEpochClaims(epochId: bigint): ClaimRecord[] {
    const claims: ClaimRecord[] = [];
    for (const records of this.claimRecords.values()) {
      for (const record of records) {
        if (record.epochId === epochId && record.claimed) {
          claims.push(record);
        }
      }
    }
    return claims;
  }

  getTotalClaimed(epochId: bigint): bigint {
    return this.totalClaimedPerEpoch.get(epochId) || 0n;
  }

  getClaimCount(epochId: bigint): number {
    return this.getEpochClaims(epochId).length;
  }

  getWalletClaims(wallet: PublicKey): ClaimRecord[] {
    const claims: ClaimRecord[] = [];
    for (const records of this.claimRecords.values()) {
      for (const record of records) {
        if (record.wallet.equals(wallet) && record.claimed) {
          claims.push(record);
        }
      }
    }
    return claims;
  }

  getState() {
    const claims = Array.from(this.claimRecords.entries()).flatMap(([, records]) =>
      records.map((r) => ({
        epochId: r.epochId.toString(),
        wallet: r.wallet.toString(),
        claimed: r.claimed,
        rewardAmount: r.rewardAmount.toString(),
        claimTimestamp: r.claimTimestamp,
      }))
    );

    return {
      claims,
      totalClaimedPerEpoch: Array.from(this.totalClaimedPerEpoch.entries()).map(
        ([epochId, amount]) => ({
          epochId: epochId.toString(),
          amount: amount.toString(),
        })
      ),
    };
  }

  static fromState(state: {
    claims: Array<{
      epochId: string;
      wallet: string;
      claimed: boolean;
      rewardAmount: string;
      claimTimestamp: number;
    }>;
    totalClaimedPerEpoch: Array<{ epochId: string; amount: string }>;
  }): ClaimHandler {
    const handler = new ClaimHandler();

    for (const claim of state.claims) {
      const claimKey = ClaimHandler.generateClaimKey(BigInt(claim.epochId), new PublicKey(claim.wallet));
      handler.claimRecords.set(claimKey, [
        {
          epochId: BigInt(claim.epochId),
          wallet: new PublicKey(claim.wallet),
          claimed: claim.claimed,
          rewardAmount: BigInt(claim.rewardAmount),
          claimTimestamp: claim.claimTimestamp,
        },
      ]);
    }

    for (const item of state.totalClaimedPerEpoch) {
      handler.totalClaimedPerEpoch.set(BigInt(item.epochId), BigInt(item.amount));
    }

    return handler;
  }
}
