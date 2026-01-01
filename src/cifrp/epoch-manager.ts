import { EpochState, CIFRP_CONSTANTS } from './types';

/**
 * Epoch Manager - manages epoch state, transitions, and finalization
 */

export class EpochManager {
  private epochs: Map<bigint, EpochState> = new Map();
  private currentEpochId: bigint = 0n;

  static getCurrentEpochId(blockTimestamp: number): bigint {
    const epochLengthSeconds = Number(CIFRP_CONSTANTS.EPOCH_LENGTH_SECONDS);
    return BigInt(Math.floor(blockTimestamp / epochLengthSeconds));
  }

  static getEpochStartTime(epochId: bigint): number {
    return Number(epochId * CIFRP_CONSTANTS.EPOCH_LENGTH_SECONDS);
  }

  static getEpochEndTime(epochId: bigint): number {
    return Number((epochId + 1n) * CIFRP_CONSTANTS.EPOCH_LENGTH_SECONDS);
  }

  initializeEpoch(
    epochId: bigint,
    poolBalance: bigint,
    merkleRoot: Buffer,
    totalWeight: bigint
  ): EpochState {
    if (this.epochs.has(epochId)) {
      throw new Error(`Epoch ${epochId} already initialized`);
    }

    const epochState: EpochState = {
      epochId,
      poolBalance,
      havocMerkleRoot: merkleRoot,
      totalWeight,
      claimedAmount: 0n,
      timestamp: Math.floor(Date.now() / 1000),
      finalized: false,
    };

    this.epochs.set(epochId, epochState);
    this.currentEpochId = epochId;
    return epochState;
  }

  getEpoch(epochId: bigint): EpochState | undefined {
    return this.epochs.get(epochId);
  }

  shouldSkipEpoch(epochId: bigint): boolean {
    const epoch = this.epochs.get(epochId);
    if (!epoch) return true;
    return epoch.poolBalance < CIFRP_CONSTANTS.MIN_POOL_DISTRIBUTION;
  }

  finalizeEpoch(epochId: bigint): void {
    const epoch = this.epochs.get(epochId);
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.finalized) throw new Error(`Epoch ${epochId} already finalized`);
    epoch.finalized = true;
  }

  recordClaim(epochId: bigint, amount: bigint): void {
    const epoch = this.epochs.get(epochId);
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    if (epoch.finalized) throw new Error(`Cannot claim from finalized epoch ${epochId}`);

    const newClaimed = epoch.claimedAmount + amount;
    if (newClaimed > epoch.poolBalance) {
      throw new Error(`Claim would exceed pool balance`);
    }
    epoch.claimedAmount = newClaimed;
  }

  getRemainingBalance(epochId: bigint): bigint {
    const epoch = this.epochs.get(epochId);
    if (!epoch) throw new Error(`Epoch ${epochId} not found`);
    return epoch.poolBalance - epoch.claimedAmount;
  }

  getDust(epochId: bigint): bigint {
    return this.getRemainingBalance(epochId);
  }

  rolloverDust(fromEpochId: bigint, toEpochId: bigint): bigint {
    const dust = this.getDust(fromEpochId);
    if (dust === 0n) return 0n;

    const toEpoch = this.epochs.get(toEpochId);
    if (!toEpoch) throw new Error(`Target epoch ${toEpochId} not found`);

    toEpoch.poolBalance = toEpoch.poolBalance + dust;
    return dust;
  }

  static canStartNewEpoch(lastEpochId: bigint, blockTimestamp: number): boolean {
    const currentEpochId = EpochManager.getCurrentEpochId(blockTimestamp);
    return currentEpochId > lastEpochId;
  }

  getAllEpochs(): EpochState[] {
    return Array.from(this.epochs.values());
  }

  getRecentEpochs(count: number): EpochState[] {
    const epochs = Array.from(this.epochs.values());
    return epochs.sort((a, b) => Number(b.epochId - a.epochId)).slice(0, count);
  }

  getState() {
    return {
      currentEpochId: this.currentEpochId.toString(),
      epochs: Array.from(this.epochs.entries()).map(([id, state]) => ({
        epochId: id.toString(),
        poolBalance: state.poolBalance.toString(),
        havocMerkleRoot: state.havocMerkleRoot.toString('hex'),
        totalWeight: state.totalWeight.toString(),
        claimedAmount: state.claimedAmount.toString(),
        timestamp: state.timestamp,
        finalized: state.finalized,
      })),
    };
  }

  static fromState(state: {
    currentEpochId: string;
    epochs: Array<{
      epochId: string;
      poolBalance: string;
      havocMerkleRoot: string;
      totalWeight: string;
      claimedAmount: string;
      timestamp: number;
      finalized: boolean;
    }>;
  }): EpochManager {
    const manager = new EpochManager();
    manager.currentEpochId = BigInt(state.currentEpochId);

    for (const epochData of state.epochs) {
      manager.epochs.set(BigInt(epochData.epochId), {
        epochId: BigInt(epochData.epochId),
        poolBalance: BigInt(epochData.poolBalance),
        havocMerkleRoot: Buffer.from(epochData.havocMerkleRoot, 'hex'),
        totalWeight: BigInt(epochData.totalWeight),
        claimedAmount: BigInt(epochData.claimedAmount),
        timestamp: epochData.timestamp,
        finalized: epochData.finalized,
      });
    }

    return manager;
  }
}
