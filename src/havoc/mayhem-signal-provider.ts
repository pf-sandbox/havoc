/**
 * Mayhem Signal Provider
 * 
 * Feeds chaos signals from Mayhem agent to Havoc.
 * Provides real-time volatility, wash-trading, and coordination suggestions.
 * 
 * TODO: Implement websocket subscription for real-time signal updates
 * TODO: Add signal validation and anomaly detection
 */

import { PublicKey, Connection } from "@solana/web3.js";
import { logger } from "../utils/logger";

export interface MayhemSignalData {
  mint: PublicKey;
  chaosLevel: number; // 0-1, magnitude of volatility
  volatilitySpike: boolean; // Sudden price movement
  washTradeDetected: boolean; // Suspicious trading pattern
  suggestedSynchronization: boolean; // Recommend Havoc sync with Mayhem
  timestamp: number;
  blockNumber?: number;
}

export interface ChaosMetrics {
  recentVolatility: number; // % price change last N blocks
  spreadWidthTrend: "widening" | "stable" | "tightening";
  volumeAnomalies: number; // Count of unusual volume events
  botActivityScore: number; // 0-1
}

/**
 * Aggregates Mayhem signals and presents them to Havoc.
 * Reads from Mayhem state accounts and emits real-time updates.
 */
export class MayhemSignalProvider {
  private connection: Connection;
  private signalHistory: Map<string, MayhemSignalData[]> = new Map();
  private metrics: Map<string, ChaosMetrics> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Poll Mayhem state and generate signal for Havoc.
   * Called before each Havoc MM decision.
   */
  async getSignal(mint: PublicKey): Promise<MayhemSignalData> {
    const mintKey = mint.toBase58();

    try {
      // Compute current chaos metrics from Mayhem state
      const metrics = await this.computeChaosMetrics(mint);
      this.metrics.set(mintKey, metrics);

      // Generate signal
      const signal: MayhemSignalData = {
        mint,
        chaosLevel: this.computeChaosLevel(metrics),
        volatilitySpike: metrics.recentVolatility > 20, // >20% in window
        washTradeDetected: metrics.botActivityScore > 0.7,
        suggestedSynchronization: this.shouldSynchronize(metrics),
        timestamp: Date.now(),
      };

      // Record signal history
      const history = this.signalHistory.get(mintKey) ?? [];
      history.push(signal);
      this.signalHistory.set(mintKey, history.slice(-1000)); // Keep last 1000

      return signal;
    } catch (error) {
      logger.error(`Failed to get Mayhem signal for ${mintKey}: ${error}`);
      return this.getDefaultSignal(mint);
    }
  }

  /**
   * Compute chaos metrics from on-chain data.
   * Inputs: recent trades, spreads, volume patterns.
   */
  private async computeChaosMetrics(mint: PublicKey): Promise<ChaosMetrics> {
    // Placeholder: would fetch from Mayhem state accounts
    return {
      recentVolatility: Math.random() * 50, // 0-50%
      spreadWidthTrend: ["widening", "stable", "tightening"][
        Math.floor(Math.random() * 3)
      ] as any,
      volumeAnomalies: Math.floor(Math.random() * 5),
      botActivityScore: Math.random(),
    };
  }

  /**
   * Convert metrics to chaos level (0-1).
   */
  private computeChaosLevel(metrics: ChaosMetrics): number {
    let chaos = 0;

    // Volatility contribution
    chaos += (metrics.recentVolatility / 100) * 0.4;

    // Spread trend contribution
    if (metrics.spreadWidthTrend === "widening") chaos += 0.2;

    // Volume anomaly contribution
    chaos += Math.min(metrics.volumeAnomalies / 10, 0.3);

    // Bot activity contribution
    chaos += metrics.botActivityScore * 0.1;

    return Math.min(chaos, 1);
  }

  /**
   * Decide if Havoc should synchronize with Mayhem.
   * True = Mayhem chaos is coordinated, Havoc should respond in kind.
   */
  private shouldSynchronize(metrics: ChaosMetrics): boolean {
    // Synchronize if bot activity is high AND spread is widening
    return metrics.botActivityScore > 0.6 && metrics.spreadWidthTrend === "widening";
  }

  /**
   * Default signal when Mayhem state unavailable.
   */
  private getDefaultSignal(mint: PublicKey): MayhemSignalData {
    return {
      mint,
      chaosLevel: 0.3, // Conservative default
      volatilitySpike: false,
      washTradeDetected: false,
      suggestedSynchronization: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Get signal history (for analysis/testing).
   */
  getSignalHistory(mint: PublicKey, limit: number = 100): MayhemSignalData[] {
    const history = this.signalHistory.get(mint.toBase58()) ?? [];
    return history.slice(-limit);
  }

  /**
   * Get current metrics (for dashboard).
   */
  getMetrics(mint: PublicKey): ChaosMetrics | null {
    return this.metrics.get(mint.toBase58()) ?? null;
  }

  /**
   * Subscribe to signal changes (future: websocket/event system).
   */
  subscribe(mint: PublicKey, callback: (signal: MayhemSignalData) => void): void {
    logger.info(`Subscribed to Mayhem signals for ${mint.toBase58().slice(0, 8)}`);
    // TODO: Implement event emitter pattern
  }

  unsubscribe(mint: PublicKey): void {
    logger.info(`Unsubscribed from Mayhem signals for ${mint.toBase58().slice(0, 8)}`);
  }
}

export default MayhemSignalProvider;
