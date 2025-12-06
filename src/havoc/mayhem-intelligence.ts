/**
 * Mayhem Intelligence Module
 * 
 * Passive observation of Mayhem actions.
 * Havoc uses this to anticipate chaos and optimize responses.
 * No active coordination - pure observation.
 */

import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger";

export interface MayhemObservation {
  mint: PublicKey;
  timestamp: number;
  actionType: "VOLUME_SPIKE" | "SPREAD_WIDENING" | "PRICE_DUMP" | "BOT_ACTIVITY";
  magnitude: number; // 0-1
  predictedDuration: number; // ms
}

export interface AnticipationSignal {
  mint: PublicKey;
  expectedChaosLevel: number; // 0-1, predicted
  likelyDuration: number;
  recommendedAction: "PREPARE_BUFFERING" | "TIGHTEN_SPREADS" | "INCREASE_LP" | "AWAIT";
  confidence: number; // 0-1
}

/**
 * Watches Mayhem patterns to predict upcoming chaos.
 * Gives Havoc a ~2-3 block head start on stabilization.
 */
export class MayhemIntelligence {
  private observationHistory: Map<string, MayhemObservation[]> = new Map();
  private patterns: Map<string, { frequency: number; avgMagnitude: number }> = new Map();

  /**
   * Observe a Mayhem action (read-only, no coordination).
   */
  recordObservation(observation: MayhemObservation): void {
    const mintKey = observation.mint.toBase58();
    const history = this.observationHistory.get(mintKey) ?? [];
    history.push(observation);
    this.observationHistory.set(mintKey, history.slice(-500)); // Keep last 500

    // Update pattern frequency
    const patternKey = `${mintKey}:${observation.actionType}`;
    const pattern = this.patterns.get(patternKey) ?? { frequency: 0, avgMagnitude: 0 };
    pattern.frequency++;
    pattern.avgMagnitude = (pattern.avgMagnitude * (pattern.frequency - 1) + observation.magnitude) / pattern.frequency;
    this.patterns.set(patternKey, pattern);
  }

  /**
   * Predict next Mayhem action based on patterns.
   * Used by Havoc to prepare defenses proactively.
   */
  anticipateNextChaos(mint: PublicKey): AnticipationSignal | null {
    const mintKey = mint.toBase58();
    const history = this.observationHistory.get(mintKey);

    if (!history || history.length < 3) {
      return null;
    }

    // Simple pattern matching: if we see N spikes in last M blocks, predict another
    const recentSpikes = history.filter((o) => Date.now() - o.timestamp < 60000).length; // Last 60s
    const avgMagnitude = history.reduce((sum, o) => sum + o.magnitude, 0) / history.length;

    if (recentSpikes > 2) {
      return {
        mint,
        expectedChaosLevel: Math.min(avgMagnitude * 1.2, 1), // Expect slightly more
        likelyDuration: 30000, // ~30s
        recommendedAction: "PREPARE_BUFFERING",
        confidence: Math.min(recentSpikes / 5, 0.95),
      };
    }

    // If spread is widening frequently, prepare compression
    const spreadWideningFreq = this.patterns.get(`${mintKey}:SPREAD_WIDENING`)?.frequency ?? 0;
    if (spreadWideningFreq > 3) {
      return {
        mint,
        expectedChaosLevel: 0.5,
        likelyDuration: 20000,
        recommendedAction: "TIGHTEN_SPREADS",
        confidence: 0.7,
      };
    }

    return null;
  }

  /**
   * Get observation history (for analysis/testing).
   */
  getHistory(mint: PublicKey, limit: number = 100): MayhemObservation[] {
    const history = this.observationHistory.get(mint.toBase58()) ?? [];
    return history.slice(-limit);
  }

  /**
   * Get pattern statistics.
   */
  getPatterns(mint: PublicKey): Map<string, { frequency: number; avgMagnitude: number }> {
    const mintKey = mint.toBase58();
    const result = new Map<string, { frequency: number; avgMagnitude: number }>();

    for (const [key, value] of this.patterns.entries()) {
      if (key.startsWith(mintKey)) {
        result.set(key.split(":")[1], value);
      }
    }

    return result;
  }
}

export default MayhemIntelligence;
