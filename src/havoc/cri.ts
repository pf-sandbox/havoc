/**
 * Creator Reputation Index (CRI)
 * 
 * Internal scoring system that evaluates dev trustworthiness.
 * All scoring logic and thresholds are opaque.
 * Only band classification (Guardian/Neutral/Adversarial) is exposed.
 */

import { PublicKey, Connection } from "@solana/web3.js";
import { logger } from "../utils/logger";

export type CRIBand = "GUARDIAN" | "NEUTRAL" | "ADVERSARIAL";

interface CRIInput {
  devWallet: PublicKey;
  previousRugDetections: number;
  rugSeverity: number; // 0-1 scale
  graduationHistory: {
    successfulLaunches: number;
    totalLaunches: number;
    avgTimeToGraduation: number;
  };
  liquidityBehavior: {
    postGraduationRetention: number; // % of LP retained after grad
    extractionVelocity: number; // tokens/sec during extraction
    frequentWithdrawals: boolean;
  };
  holderDistribution: {
    topHolderConcentration: number; // % of supply in top holder
    giniCoefficient: number; // 0-1, concentration measure
  };
  earlySellingPatterns: {
    presaleExitRate: number; // % presale exited before launch
    firstHourVolatility: number; // price change % in first hour
  };
  botActivity: {
    suspiciousBotWashTrades: number; // detected wash cycles
    flashLoanExploits: number;
  };
  positiveIndicators: {
    consistentLiquidityAdditions: boolean;
    stableLaunchHistory: boolean;
    holderGrowthQuality: boolean;
  };
}

interface CRIRecord {
  devWallet: PublicKey;
  internalScore: number; // 0-100, never exposed
  band: CRIBand;
  lastUpdated: number;
  observationCount: number;
  historicalBands: CRIBand[]; // For trend analysis
  rugDetections: { timestamp: number; severity: number }[]; // For temporal decay
  recidivismCount: number; // Number of times dev rugged before
}

/**
 * Apply temporal decay to historical rug detections.
 * Recent rugs matter more; old rugs fade (but recidivism amplifies them).
 */
function applyTemporalDecay(
  rugDetections: { timestamp: number; severity: number }[],
  recidivismCount: number
): number {
  let decayedPenalty = 0;
  const now = Date.now();
  const HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  
  for (const detection of rugDetections) {
    const ageMs = now - detection.timestamp;
    // Exponential decay: severity * e^(-age / half_life)
    const decayFactor = Math.exp(-ageMs / HALF_LIFE_MS);
    const decayedSeverity = detection.severity * decayFactor;
    decayedPenalty += decayedSeverity;
  }
  
  // Recidivism multiplier: each rug after the first is worse
  // First rug: 1x, Second: 2.5x, Third+: 4x
  const recidivismMultiplier = recidivismCount === 0 ? 1 : 
    recidivismCount === 1 ? 2.5 : 4;
  
  return decayedPenalty * recidivismMultiplier;
}

/**
 * Opaque scoring algorithm.
 * Deterministic, but not exposed externally.
 * Inputs are weighted and combined in a non-obvious way.
 * Incorporates temporal decay for rug history and recidivism penalties.
 */
function computeScore(input: CRIInput, record?: CRIRecord): number {
  // Internal calculation remains black box
  // Below is a placeholder architecture - actual weights/formulas are hidden
  
  let score = 50; // Neutral baseline
  
  // Rug penalty with temporal decay (if record available)
  if (record) {
    const decayedRugPenalty = applyTemporalDecay(
      record.rugDetections,
      record.recidivismCount
    );
    score -= Math.min(decayedRugPenalty * 20, 45); // Cap at 45 points
  } else {
    // Fallback for first evaluation (no historical data)
    score -= Math.min(input.previousRugDetections * 15, 40);
    score -= input.rugSeverity * 20;
  }
  
  // Graduation history bonus
  const gradRate = input.graduationHistory.successfulLaunches / 
    Math.max(input.graduationHistory.totalLaunches, 1);
  score += gradRate * 20;
  
  // Liquidity retention reward
  score += input.liquidityBehavior.postGraduationRetention * 15;
  
  // Extraction velocity penalty (hidden threshold)
  if (input.liquidityBehavior.extractionVelocity > 1000) {
    score -= 25;
  }
  
  // Holder concentration penalty
  if (input.holderDistribution.topHolderConcentration > 0.3) {
    score -= Math.pow(input.holderDistribution.topHolderConcentration, 1.5) * 30;
  }
  
  // Early sell pattern penalty
  score -= input.earlySellingPatterns.presaleExitRate * 15;
  score -= Math.min(input.earlySellingPatterns.firstHourVolatility / 100, 1) * 20;
  
  // Bot activity penalty
  score -= input.botActivity.suspiciousBotWashTrades * 5;
  score -= input.botActivity.flashLoanExploits * 40;
  
  // Positive indicators bonus
  if (input.positiveIndicators.consistentLiquidityAdditions) score += 10;
  if (input.positiveIndicators.stableLaunchHistory) score += 15;
  if (input.positiveIndicators.holderGrowthQuality) score += 10;
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Map internal score to band classification.
 * Thresholds are intentionally not exposed.
 */
function scoreToBand(score: number): CRIBand {
  // Threshold boundaries kept internal
  if (score >= 80) return "GUARDIAN";
  if (score >= 40) return "NEUTRAL";
  return "ADVERSARIAL";
}

export class CreatorReputationIndex {
  private records: Map<string, CRIRecord> = new Map();
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Evaluate or update a dev's CRI.
   * Returns only the band classification externally.
   * Incorporates temporal decay and recidivism.
   */
  async evaluate(input: CRIInput): Promise<CRIBand> {
    const devKey = input.devWallet.toBase58();
    const existing = this.records.get(devKey);
    
    // Compute internal score with temporal awareness
    const score = computeScore(input, existing);
    const band = scoreToBand(score);
    
    // Initialize or update record
    const record: CRIRecord = {
      devWallet: input.devWallet,
      internalScore: score,
      band,
      lastUpdated: Date.now(),
      observationCount: (existing?.observationCount ?? 0) + 1,
      historicalBands: [...(existing?.historicalBands ?? []), band].slice(-100),
      rugDetections: existing?.rugDetections ?? [],
      recidivismCount: existing?.recidivismCount ?? 0,
    };
    
    this.records.set(devKey, record);
    
    // Log only the band change, not the score or logic
    if (existing && existing.band !== band) {
      logger.info(`CRI update for ${devKey.slice(0, 8)}: ${existing.band} → ${band}`);
    }
    
    return band;
  }

  /**
   * Record a rug detection for temporal decay tracking.
   */
  recordRugDetection(devWallet: PublicKey, severity: number): void {
    const devKey = devWallet.toBase58();
    const record = this.records.get(devKey);
    
    if (record) {
      record.rugDetections.push({ timestamp: Date.now(), severity });
      
      // Check if this is a repeat offense
      const recentRugs = record.rugDetections.filter(
        (r) => Date.now() - r.timestamp < 60 * 24 * 60 * 60 * 1000 // 60 days
      );
      
      if (recentRugs.length > 1) {
        record.recidivismCount++;
      }
      
      logger.warn(
        `Rug recorded for ${devKey.slice(0, 8)}: severity=${severity.toFixed(2)}, recidivism=${record.recidivismCount}`
      );
    }
  }

  /**
   * Get only the band for a dev (opaque externally).
   */
  getBand(devWallet: PublicKey): CRIBand | null {
    const record = this.records.get(devWallet.toBase58());
    return record?.band ?? null;
  }

  /**
   * Check if band qualifies for a certain mode.
   * Internal decision logic, not exposed.
   */
  isGuardianMode(devWallet: PublicKey): boolean {
    return this.getBand(devWallet) === "GUARDIAN";
  }

  isAdversarialMode(devWallet: PublicKey): boolean {
    return this.getBand(devWallet) === "ADVERSARIAL";
  }

  /**
   * For internal testing only: expose score (removed in production).
   */
  getScoreForTesting(devWallet: PublicKey): number | null {
    const record = this.records.get(devWallet.toBase58());
    return record?.internalScore ?? null;
  }

  /**
   * Get observation history for trend analysis (internal use).
   */
  private getTrendForTesting(devWallet: PublicKey): CRIBand[] {
    const record = this.records.get(devWallet.toBase58());
    return record?.historicalBands ?? [];
  }
}

export default CreatorReputationIndex;
