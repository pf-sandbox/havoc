/**
 * ML-Based Pattern Detector
 * 
 * Uses simple statistical learning to detect and predict chaos patterns.
 * Learns from Mayhem observations to improve anticipation accuracy.
 * 
 * Algorithms:
 * - Moving average for trend detection
 * - Standard deviation for anomaly scoring
 * - Markov chain for state prediction
 * - Simple linear regression for magnitude forecasting
 */

import { PublicKey } from "@solana/web3.js";
import { logger } from "../utils/logger";

export interface PatternSignature {
  type: string;
  frequency: number; // Events per hour
  avgMagnitude: number;
  stdDev: number;
  lastOccurrence: number;
}

export interface AnomalyScore {
  severity: number; // 0-1
  isAnomaly: boolean;
  deviation: number; // Standard deviations from mean
  confidence: number; // 0-1
}

export interface TransitionProbability {
  from: string;
  to: string;
  probability: number; // 0-1
  count: number;
}

/**
 * Learns from observation patterns to predict next chaos.
 */
export class PatternDetector {
  private patterns: Map<string, { observations: number[]; lastUpdate: number }> = new Map();
  private transitions: Map<string, Map<string, number>> = new Map(); // Markov chains
  private history: Map<string, string[]> = new Map(); // Action sequence history

  /**
   * Record a magnitude observation for a pattern type.
   */
  recordMagnitude(mint: PublicKey, patternType: string, magnitude: number): void {
    const key = `${mint.toBase58()}:${patternType}`;
    const entry = this.patterns.get(key) ?? { observations: [], lastUpdate: Date.now() };
    
    entry.observations.push(magnitude);
    entry.lastUpdate = Date.now();
    
    // Keep last 1000 observations
    if (entry.observations.length > 1000) {
      entry.observations = entry.observations.slice(-1000);
    }
    
    this.patterns.set(key, entry);
  }

  /**
   * Record a state transition in the Markov chain.
   */
  recordTransition(mint: PublicKey, from: string, to: string): void {
    const key = mint.toBase58();
    
    if (!this.transitions.has(key)) {
      this.transitions.set(key, new Map());
    }
    
    const chain = this.transitions.get(key)!;
    const transitionKey = `${from}→${to}`;
    chain.set(transitionKey, (chain.get(transitionKey) ?? 0) + 1);
    
    // Track sequence history
    const seq = this.history.get(key) ?? [];
    seq.push(to);
    this.history.set(key, seq.slice(-100)); // Keep last 100
  }

  /**
   * Compute anomaly score for a magnitude observation.
   * Returns 0-1 severity and whether it's anomalous (>2 std devs from mean).
   */
  getAnomalyScore(
    mint: PublicKey,
    patternType: string,
    observation: number
  ): AnomalyScore {
    const key = `${mint.toBase58()}:${patternType}`;
    const entry = this.patterns.get(key);

    if (!entry || entry.observations.length < 3) {
      return {
        severity: 0.3,
        isAnomaly: false,
        deviation: 0,
        confidence: 0.2,
      };
    }

    const obs = entry.observations;
    const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
    const variance =
      obs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / obs.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return {
        severity: Math.abs(observation - mean) > 0.01 ? 0.5 : 0.1,
        isAnomaly: false,
        deviation: 0,
        confidence: 0.5,
      };
    }

    const deviation = (observation - mean) / stdDev;
    const isAnomaly = Math.abs(deviation) > 2; // 2-sigma rule

    // Severity: clamp deviation to 0-1 range
    const severity = Math.min(Math.abs(deviation) / 4, 1);
    const confidence = Math.min(obs.length / 50, 0.95); // Increases with data

    return {
      severity,
      isAnomaly,
      deviation,
      confidence,
    };
  }

  /**
   * Predict next action based on Markov chain.
   */
  predictNextAction(mint: PublicKey): string | null {
    const seq = this.history.get(mint.toBase58());
    if (!seq || seq.length === 0) return null;

    const lastAction = seq[seq.length - 1];
    const chain = this.transitions.get(mint.toBase58());
    if (!chain) return null;

    // Find highest probability transition from lastAction
    let maxProb = 0;
    let nextAction: string | null = null;

    for (const [transKey, count] of chain.entries()) {
      if (transKey.startsWith(`${lastAction}→`)) {
        if (count > maxProb) {
          maxProb = count;
          nextAction = transKey.split("→")[1];
        }
      }
    }

    return nextAction;
  }

  /**
   * Get transition probabilities from a state.
   */
  getTransitionProbabilities(mint: PublicKey, fromState: string): TransitionProbability[] {
    const chain = this.transitions.get(mint.toBase58());
    if (!chain) return [];

    const total = Array.from(chain.values())
      .filter((_, key) => key.startsWith(`${fromState}→`))
      .reduce((a, b) => a + b, 0);

    if (total === 0) return [];

    const results: TransitionProbability[] = [];
    for (const [transKey, count] of chain.entries()) {
      if (transKey.startsWith(`${fromState}→`)) {
        const toState = transKey.split("→")[1];
        results.push({
          from: fromState,
          to: toState,
          probability: count / total,
          count,
        });
      }
    }

    return results.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Forecast next magnitude using simple linear regression.
   */
  forecastMagnitude(
    mint: PublicKey,
    patternType: string,
    lookaheadSteps: number = 1
  ): { forecast: number; confidence: number } | null {
    const key = `${mint.toBase58()}:${patternType}`;
    const entry = this.patterns.get(key);

    if (!entry || entry.observations.length < 5) {
      return null;
    }

    const obs = entry.observations.slice(-20); // Last 20 observations
    const n = obs.length;

    // Linear regression: y = a + bx
    const xMean = (n - 1) / 2;
    const yMean = obs.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (obs[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    // Forecast at lookaheadSteps
    const forecast = intercept + slope * (n - 1 + lookaheadSteps);
    const clampedForecast = Math.max(0, Math.min(forecast, 1)); // Clamp to 0-1

    // Confidence decreases with steps ahead
    const confidence = Math.max(0.4, 0.9 / (1 + lookaheadSteps * 0.5));

    return {
      forecast: clampedForecast,
      confidence,
    };
  }

  /**
   * Get pattern statistics.
   */
  getPatternStats(mint: PublicKey, patternType: string): PatternSignature | null {
    const key = `${mint.toBase58()}:${patternType}`;
    const entry = this.patterns.get(key);

    if (!entry || entry.observations.length === 0) {
      return null;
    }

    const obs = entry.observations;
    const mean = obs.reduce((a, b) => a + b, 0) / obs.length;
    const variance =
      obs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / obs.length;
    const stdDev = Math.sqrt(variance);

    // Frequency: events per hour (rough estimate)
    const ageMs = Date.now() - entry.lastUpdate;
    const frequency = (obs.length / Math.max(ageMs, 1)) * 60 * 60 * 1000;

    return {
      type: patternType,
      frequency,
      avgMagnitude: mean,
      stdDev,
      lastOccurrence: entry.lastUpdate,
    };
  }

  /**
   * Clear all patterns (for testing/reset).
   */
  clearPatterns(): void {
    this.patterns.clear();
    this.transitions.clear();
    this.history.clear();
    logger.debug("Pattern detector cleared");
  }
}

export default PatternDetector;
