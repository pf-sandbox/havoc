/**
 * Havoc AI Market-Maker Engine
 * 
 * Black-boxed market-making logic.
 * Accepts pool state and CRI band, outputs intervention decisions.
 * Only logs action timestamps and types, not the underlying logic.
 * 
 * Coordination note: Tested in tandem with Mayhem agent.
 * See tests/havoc-mayhem-coordination.test.ts for interaction validation.
 */

import { PublicKey } from "@solana/web3.js";
import { CRIBand } from "./cri";
import { logger } from "../utils/logger";

export type MMMode = "GUARDIAN" | "NEUTRAL" | "ADVERSARIAL" | "COORDINATED";

export interface PoolState {
  mint: PublicKey;
  currentPrice: number;
  priceHistory: number[]; // last N prices
  bidAskSpread: number; // absolute value
  spreadBps: number; // basis points
  volume24h: number; // SOL
  liquidity: {
    native: number; // SOL reserves
    token: number;
  };
  volatility: number; // % price change in window
  orderBookImbalance: number; // -1 to 1, buy-side bias
}

export interface MMAction {
  type: "SPREAD_COMPRESSION" | "VOLUME_SMOOTHING" | "MOMENTUM_VALIDATION" | 
         "EXTRACTION_SUPPRESSION" | "CRASH_BUFFERING" | "NO_ACTION";
  timestamp: number;
  signature?: string; // Transaction signature if executed
  // Internal reasoning hidden
}

export interface MMModeContext {
  criband: CRIBand;
  mayhemSignals?: MayhemSignal; // Optional coordination input
  windowSize: number; // Blocks or time window
}

export interface MayhemSignal {
  chaosLevel: number; // 0-1 magnitude
  suggestedSynchronization: boolean;
  timestamp: number;
}

/**
 * Internal black-box market-making logic.
 * Algorithm details are proprietary.
 */
class HavocMarketMaker {
  private actionLog: MMAction[] = [];
  private lastActionTime: Map<string, number> = new Map();
  private confidenceScores: Map<string, number> = new Map();

  /**
   * Main decision engine.
   * Accepts observable state, returns action type only.
   */
  async decideAction(poolState: PoolState, context: MMModeContext): Promise<MMAction> {
    const action: MMAction = {
      type: "NO_ACTION",
      timestamp: Date.now(),
    };

    // Internal logic branching (black box)
    const internalSignal = this.computeInternalSignal(poolState, context);
    
    if (context.criband === "GUARDIAN") {
      // Guardian mode: stabilize and support
      action.type = this.guardianModeDecision(poolState, internalSignal);
    } else if (context.criband === "ADVERSARIAL") {
      // Adversarial mode: restrict and friction
      action.type = this.adversarialModeDecision(poolState, internalSignal);
    } else {
      // Neutral mode: mild intervention
      action.type = this.neutralModeDecision(poolState, internalSignal);
    }

    // Mayhem coordination (if provided)
    if (context.mayhemSignals) {
      action.type = this.coordinateWithMayhem(action.type, context.mayhemSignals, context.criband);
    }

    this.actionLog.push(action);
    logger.info(`MM action [${action.type}] for ${poolState.mint.toBase58().slice(0, 8)}`);

    return action;
  }

  /**
   * Internal computation (not exposed).
   */
  private computeInternalSignal(poolState: PoolState, context: MMModeContext): number {
    // Black box: combines volatility, spread, volume, momentum
    let signal = 0;

    // Volatility factor (hidden formula)
    signal += poolState.volatility * 0.3;

    // Spread factor (hidden threshold)
    const normalizedSpread = poolState.spreadBps / 100;
    signal += normalizedSpread * 0.25;

    // Volume momentum (hidden calculation)
    signal += (poolState.volume24h / 100) * 0.2;

    // Order book imbalance (hidden weighting)
    signal += Math.abs(poolState.orderBookImbalance) * 0.25;

    return signal;
  }

  /**
   * Guardian mode decision (internal).
   */
  private guardianModeDecision(poolState: PoolState, signal: number): MMAction["type"] {
    // Favor stabilization and smoothing
    if (poolState.spreadBps > 200) return "SPREAD_COMPRESSION";
    if (poolState.volatility > 15) return "VOLUME_SMOOTHING";
    if (signal > 0.7) return "MOMENTUM_VALIDATION";
    return "NO_ACTION";
  }

  /**
   * Adversarial mode decision (internal).
   */
  private adversarialModeDecision(poolState: PoolState, signal: number): MMAction["type"] {
    // Add friction, suppress extraction
    if (signal > 0.8) return "EXTRACTION_SUPPRESSION";
    if (poolState.volatility > 25) return "CRASH_BUFFERING";
    if (poolState.orderBookImbalance > 0.6) return "EXTRACTION_SUPPRESSION";
    return "NO_ACTION";
  }

  /**
   * Neutral mode decision (internal).
   */
  private neutralModeDecision(poolState: PoolState, signal: number): MMAction["type"] {
    if (poolState.spreadBps > 300) return "SPREAD_COMPRESSION";
    if (poolState.volatility > 20) return "VOLUME_SMOOTHING";
    return "NO_ACTION";
  }

  /**
   * Coordination with Mayhem agent.
   * Tested in parallel (see tests/havoc-mayhem-coordination.test.ts).
   */
  private coordinateWithMayhem(
    decision: MMAction["type"],
    mayhemSignal: MayhemSignal,
    criband: CRIBand
  ): MMAction["type"] {
    // High CRI: Havoc neutralizes Mayhem chaos
    if (criband === "GUARDIAN" && mayhemSignal.chaosLevel > 0.7) {
      if (decision === "NO_ACTION") {
        return "CRASH_BUFFERING"; // Dampening
      }
    }

    // Low CRI: Havoc and Mayhem synchronize adversarial patterns
    if (criband === "ADVERSARIAL" && mayhemSignal.suggestedSynchronization) {
      return "EXTRACTION_SUPPRESSION"; // Joint pressure
    }

    return decision;
  }

  /**
   * Get action log (for transparency and testing).
   */
  getActionLog(limit: number = 100): MMAction[] {
    return this.actionLog.slice(-limit);
  }

  /**
   * Check rate limiting (internal state tracking).
   */
  isRateLimited(poolId: string, cooldownMs: number = 30000): boolean {
    const lastTime = this.lastActionTime.get(poolId);
    if (!lastTime) return false;
    return Date.now() - lastTime < cooldownMs;
  }

  /**
   * Update rate limiting state.
   */
  recordAction(poolId: string): void {
    this.lastActionTime.set(poolId, Date.now());
  }

  /**
   * Confidence scoring (internal, for testing only).
   */
  setConfidenceForTesting(poolId: string, score: number): void {
    this.confidenceScores.set(poolId, score);
  }

  getConfidenceForTesting(poolId: string): number | null {
    return this.confidenceScores.get(poolId) ?? null;
  }
}

export default HavocMarketMaker;
