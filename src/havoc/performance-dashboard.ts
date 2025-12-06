/**
 * Performance Dashboard & Metrics
 * 
 * Tracks and aggregates Havoc performance metrics for monitoring and analysis.
 * Exposes metrics for public dashboards and internal reporting.
 * 
 * TODO: Add grafana integration for real-time dashboard
 * TODO: Implement prometheus metrics export
 * TODO: Add historical metric persistence to database
 */

import { PublicKey } from "@solana/web3.js";
import { CRIBand } from "./cri";
import { HavocState } from "./state-machine";
import { logger } from "../utils/logger";

export interface PerformanceMetrics {
  mint: PublicKey;
  startTime: number;
  endTime?: number;
  // CRI metrics
  criHistory: { timestamp: number; band: CRIBand }[];
  // MM metrics
  totalActionsExecuted: number;
  actionBreakdown: Record<string, number>;
  // Liquidity metrics
  totalLiquidityDeployed: number; // SOL
  spreadCompressions: number;
  volumeSmoothed: number; // % reduced
  // State metrics
  stateTransitions: number;
  timeInEachState: Record<HavocState, number>;
  // Price metrics
  priceAtStart: number;
  priceAtEnd?: number;
  volatilityReduction: number; // %
  // Rug prevention
  rugsDetected: number;
  rugsSuppressed: number;
  // Community participation score (internal, reserved for future distribution mechanisms)
  participationScore?: number;
}

export interface DashboardSnapshot {
  timestamp: number;
  activeTokens: number;
  avgCriScore: number;
  bandDistribution: Record<CRIBand, number>;
  totalActionsLast24h: number;
  avgVolatility: number;
  rugPreventionRate: number; // % of attempted rugs blocked
}

/**
 * Aggregates performance data across all tokens being monitored.
 */
export class PerformanceDashboard {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private snapshots: DashboardSnapshot[] = [];
  private lastSnapshotTime: number = Date.now();

  /**
   * Initialize metrics tracking for a token.
   */
  startTracking(mint: PublicKey, startPrice: number): void {
    const mintKey = mint.toBase58();

    this.metrics.set(mintKey, {
      mint,
      startTime: Date.now(),
      criHistory: [],
      totalActionsExecuted: 0,
      actionBreakdown: {},
      totalLiquidityDeployed: 0,
      spreadCompressions: 0,
      volumeSmoothed: 0,
      stateTransitions: 0,
      timeInEachState: {
        INIT: 0,
        ACTIVE: 0,
        GUARDIAN: 0,
        NEUTRAL: 0,
        ADVERSARIAL: 0,
        COOLDOWN: 0,
        TERMINATED: 0,
      },
      priceAtStart: startPrice,
      volatilityReduction: 0,
      rugsDetected: 0,
      rugsSuppressed: 0,
      participationScore: 0,
    });

    logger.info(`Performance tracking started for ${mintKey.slice(0, 8)}`);
  }

  /**
   * Record a CRI band change.
   */
  recordCriBandChange(mint: PublicKey, band: CRIBand): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.criHistory.push({ timestamp: Date.now(), band });
    }
  }

  /**
   * Record a MM action executed.
   */
  recordAction(mint: PublicKey, actionType: string): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.totalActionsExecuted++;
      metrics.actionBreakdown[actionType] = (metrics.actionBreakdown[actionType] ?? 0) + 1;
      // Participation scoring (internal use)
      if (metrics.participationScore !== undefined) {
        metrics.participationScore += 1;
      }
    }
  }

  /**
   * Record liquidity deployment.
   */
  recordLiquidityDeployment(mint: PublicKey, amountSol: number, action: string): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.totalLiquidityDeployed += amountSol;
      if (action === "SPREAD_COMPRESSION") {
        metrics.spreadCompressions++;
      }
    }
  }

  /**
   * Record state transition.
   */
  recordStateTransition(mint: PublicKey, newState: HavocState, elapsedMs: number): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.stateTransitions++;
      // Don't double-count: this records transition INTO new state
    }
  }

  /**
   * Record rug detection and suppression.
   */
  recordRugEvent(mint: PublicKey, detected: boolean, suppressed: boolean): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      if (detected) metrics.rugsDetected++;
      if (suppressed) metrics.rugsSuppressed++;
    }
  }

  /**
   * Record price change.
   */
  recordPriceChange(mint: PublicKey, currentPrice: number): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics && metrics.priceAtStart > 0) {
      const change = Math.abs(currentPrice - metrics.priceAtStart) / metrics.priceAtStart;
      metrics.priceAtEnd = currentPrice;
      // Would track volatility reduction relative to Mayhem-only scenario
    }
  }

  /**
   * Record volume smoothing effect.
   */
  recordVolumeSmoothingEffect(mint: PublicKey, percentReduction: number): void {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.volumeSmoothed += percentReduction;
    }
  }

  /**
   * Finalize metrics for a token.
   */
  stopTracking(mint: PublicKey): PerformanceMetrics | null {
    const metrics = this.metrics.get(mint.toBase58());
    if (metrics) {
      metrics.endTime = Date.now();
      logger.info(
        `Performance tracking ended for ${mint.toBase58().slice(0, 8)}: ` +
          `${metrics.totalActionsExecuted} actions, ` +
          `${metrics.rugsDetected} rugs detected, ` +
          `${metrics.rugsSuppressed} suppressed`
      );
      return metrics;
    }
    return null;
  }

  /**
   * Get metrics for a token.
   */
  getMetrics(mint: PublicKey): PerformanceMetrics | null {
    return this.metrics.get(mint.toBase58()) ?? null;
  }

  /**
   * Generate dashboard snapshot (aggregated across all tokens).
   */
  generateSnapshot(): DashboardSnapshot {
    const metrics = Array.from(this.metrics.values());
    const activeTokens = metrics.filter((m) => !m.endTime).length;

    // Aggregate CRI history to get avg
    let totalCri = 0;
    let criCount = 0;
    const bandCounts: Record<CRIBand, number> = {
      GUARDIAN: 0,
      NEUTRAL: 0,
      ADVERSARIAL: 0,
    };

    metrics.forEach((m) => {
      if (m.criHistory.length > 0) {
        const lastBand = m.criHistory[m.criHistory.length - 1].band;
        bandCounts[lastBand]++;
      }
    });

    // Aggregate actions
    const totalActions = metrics.reduce((sum, m) => sum + m.totalActionsExecuted, 0);

    // Aggregate volatility reduction
    const avgVolatility = metrics.reduce((sum, m) => sum + m.volatilityReduction, 0) / metrics.length || 0;

    // Rug prevention rate
    const totalRugsDetected = metrics.reduce((sum, m) => sum + m.rugsDetected, 0);
    const totalRugsSuppressed = metrics.reduce((sum, m) => sum + m.rugsSuppressed, 0);
    const rugPreventionRate =
      totalRugsDetected > 0 ? (totalRugsSuppressed / totalRugsDetected) * 100 : 0;

    const snapshot: DashboardSnapshot = {
      timestamp: Date.now(),
      activeTokens,
      avgCriScore: criCount > 0 ? totalCri / criCount : 0,
      bandDistribution: bandCounts,
      totalActionsLast24h: totalActions,
      avgVolatility,
      rugPreventionRate,
    };

    this.snapshots.push(snapshot);
    this.lastSnapshotTime = Date.now();

    return snapshot;
  }

  /**
   * Get dashboard snapshot history.
   */
  getSnapshotHistory(limit: number = 288): DashboardSnapshot[] {
    // 288 = 24h of 5min snapshots
    return this.snapshots.slice(-limit);
  }

  /**
   * Get summary stats (for API/public display).
   */
  getSummaryStats(): {
    tokensMonitored: number;
    totalActionsExecuted: number;
    rugsDetected: number;
    rugsSuppressed: number;
    avgVolatilityReduction: number;
    uptime: number;
  } {
    const metrics = Array.from(this.metrics.values());

    return {
      tokensMonitored: metrics.length,
      totalActionsExecuted: metrics.reduce((sum, m) => sum + m.totalActionsExecuted, 0),
      rugsDetected: metrics.reduce((sum, m) => sum + m.rugsDetected, 0),
      rugsSuppressed: metrics.reduce((sum, m) => sum + m.rugsSuppressed, 0),
      avgVolatilityReduction: metrics.reduce((sum, m) => sum + m.volatilityReduction, 0) / metrics.length || 0,
      uptime: Date.now() - this.lastSnapshotTime,
    };
  }

  /**
   * Export metrics as JSON (for reporting).
   */
  exportMetrics(mint?: PublicKey): object {
    if (mint) {
      return this.metrics.get(mint.toBase58()) ?? {};
    }
    return Object.fromEntries(
      Array.from(this.metrics.entries()).map(([key, val]) => [key, val])
    );
  }
}

export default PerformanceDashboard;
