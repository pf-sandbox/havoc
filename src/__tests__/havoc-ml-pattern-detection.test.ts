/**
 * ML-Based Pattern Detection Tests
 * 
 * Validates machine learning models for chaos prediction and anomaly detection.
 * Tests:
 * - Anomaly scoring accuracy
 * - Markov chain state predictions
 * - Linear regression forecasting
 * - Pattern learning over time
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { PublicKey } from "@solana/web3.js";
import PatternDetector from "../havoc/pattern-detector";

describe("ML Pattern Detection: Anomaly Scoring", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintForAnomalyxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should classify normal observations as non-anomalous", () => {
    // Record 20 normal observations (mean ~0.5, low variance)
    for (let i = 0; i < 20; i++) {
      detector.recordMagnitude(testMint, "VOLUME_SPIKE", 0.5 + Math.random() * 0.05);
    }

    const score = detector.getAnomalyScore(testMint, "VOLUME_SPIKE", 0.48);
    expect(score.isAnomaly).toBe(false);
    expect(score.severity).toBeLessThan(0.5);
  });

  it("should flag extreme outliers as anomalies", () => {
    // Record normal distribution
    for (let i = 0; i < 30; i++) {
      detector.recordMagnitude(testMint, "SPREAD_WIDENING", 0.3 + Math.random() * 0.1);
    }

    // Record extreme outlier
    const anomalyScore = detector.getAnomalyScore(testMint, "SPREAD_WIDENING", 0.95);
    expect(anomalyScore.isAnomaly).toBe(true);
    expect(anomalyScore.severity).toBeGreaterThan(0.7);
    expect(anomalyScore.confidence).toBeGreaterThan(0.5);
  });

  it("should increase confidence with more observations", () => {
    const mint2 = new PublicKey("MLTestMint2Anomalyxxxxxxxxxxxxxxxxxxx");

    // Small dataset
    for (let i = 0; i < 5; i++) {
      detector.recordMagnitude(mint2, "PRICE_DUMP", 0.6 + Math.random() * 0.1);
    }
    const scoreSmall = detector.getAnomalyScore(mint2, "PRICE_DUMP", 0.7);

    // Large dataset
    const mint3 = new PublicKey("MLTestMint3Anomalyxxxxxxxxxxxxxxxxxxx");
    for (let i = 0; i < 100; i++) {
      detector.recordMagnitude(mint3, "PRICE_DUMP", 0.6 + Math.random() * 0.1);
    }
    const scoreLarge = detector.getAnomalyScore(mint3, "PRICE_DUMP", 0.7);

    expect(scoreLarge.confidence).toBeGreaterThan(scoreSmall.confidence);
  });
});

describe("ML Pattern Detection: Markov Chain Prediction", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintMarkovxxxxxxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should learn simple state transitions", () => {
    // Create a pattern: VOLUME_SPIKE → SPREAD_WIDENING → PRICE_DUMP (repeating)
    const sequence = ["VOLUME_SPIKE", "SPREAD_WIDENING", "PRICE_DUMP"];

    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < sequence.length - 1; i++) {
        detector.recordTransition(testMint, sequence[i], sequence[i + 1]);
      }
    }

    // After VOLUME_SPIKE, should predict SPREAD_WIDENING
    const probs = detector.getTransitionProbabilities(testMint, "VOLUME_SPIKE");
    expect(probs.length).toBeGreaterThan(0);
    expect(probs[0].to).toBe("SPREAD_WIDENING");
    expect(probs[0].probability).toBeGreaterThan(0.8);
  });

  it("should predict next action based on history", () => {
    // Alternating pattern: A → B → A → B
    detector.recordTransition(testMint, "ACTION_A", "ACTION_B");
    detector.recordTransition(testMint, "ACTION_B", "ACTION_A");
    detector.recordTransition(testMint, "ACTION_A", "ACTION_B");
    detector.recordTransition(testMint, "ACTION_B", "ACTION_A");
    detector.recordTransition(testMint, "ACTION_B", "ACTION_A");

    const next = detector.predictNextAction(testMint);
    expect(next).not.toBeNull();
    expect(["ACTION_A", "ACTION_B"]).toContain(next);
  });

  it("should handle probabilistic outcomes", () => {
    // 70% A→C, 30% A→B
    for (let i = 0; i < 7; i++) {
      detector.recordTransition(testMint, "START", "CRASH_BUFFER");
    }
    for (let i = 0; i < 3; i++) {
      detector.recordTransition(testMint, "START", "SPREAD_COMPRESSION");
    }

    const probs = detector.getTransitionProbabilities(testMint, "START");
    expect(probs[0].to).toBe("CRASH_BUFFER");
    expect(probs[0].probability).toBeCloseTo(0.7, 1);
  });
});

describe("ML Pattern Detection: Forecasting", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintForecastxxxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should forecast increasing trend", () => {
    // Linear trend: 0.1 → 0.2 → 0.3 → ... → 0.9
    for (let i = 0; i < 9; i++) {
      detector.recordMagnitude(testMint, "VOLATILITY", (i + 1) * 0.1);
    }

    const forecast = detector.forecastMagnitude(testMint, "VOLATILITY", 1);
    expect(forecast).not.toBeNull();
    expect(forecast?.forecast).toBeGreaterThan(0.85);
    expect(forecast?.confidence).toBeGreaterThan(0.6);
  });

  it("should forecast decreasing trend", () => {
    // Decreasing: 0.9 → 0.8 → 0.7 → ... → 0.1
    for (let i = 9; i > 0; i--) {
      detector.recordMagnitude(testMint, "VOLATILITY", i * 0.1);
    }

    const forecast = detector.forecastMagnitude(testMint, "VOLATILITY", 1);
    expect(forecast).not.toBeNull();
    expect(forecast?.forecast).toBeLessThan(0.2);
  });

  it("should have lower confidence with more lookahead", () => {
    // Create trend
    for (let i = 0; i < 20; i++) {
      detector.recordMagnitude(testMint, "VOLUME", 0.5 + Math.sin(i) * 0.2);
    }

    const forecast1 = detector.forecastMagnitude(testMint, "VOLUME", 1);
    const forecast5 = detector.forecastMagnitude(testMint, "VOLUME", 5);

    expect(forecast1?.confidence).toBeGreaterThan(forecast5?.confidence ?? 0);
  });
});

describe("ML Pattern Detection: Pattern Statistics", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintStatsxxxxxxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should compute accurate mean and standard deviation", () => {
    const values = [0.3, 0.4, 0.5, 0.6, 0.7]; // mean=0.5, std≈0.158
    for (const val of values) {
      detector.recordMagnitude(testMint, "TEST_PATTERN", val);
    }

    const stats = detector.getPatternStats(testMint, "TEST_PATTERN");
    expect(stats?.avgMagnitude).toBeCloseTo(0.5, 1);
    expect(stats?.stdDev).toBeCloseTo(0.158, 1);
  });

  it("should track pattern frequency", () => {
    // Record 10 observations in quick succession
    for (let i = 0; i < 10; i++) {
      detector.recordMagnitude(testMint, "FREQ_PATTERN", 0.5 + Math.random() * 0.1);
    }

    const stats = detector.getPatternStats(testMint, "FREQ_PATTERN");
    expect(stats?.frequency).toBeGreaterThan(0);
  });
});

describe("ML Pattern Detection: Real-World Scenarios", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintScenariossxxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should detect pump-and-dump pattern", () => {
    // Phase 1: Normal (0.2-0.3)
    for (let i = 0; i < 10; i++) {
      detector.recordMagnitude(testMint, "VOLUME", 0.25 + Math.random() * 0.05);
    }

    // Phase 2: Spike (0.8-0.9)
    for (let i = 0; i < 5; i++) {
      detector.recordMagnitude(testMint, "VOLUME", 0.85 + Math.random() * 0.1);
    }

    // Phase 3: Crash (0.1)
    const crashScore = detector.getAnomalyScore(testMint, "VOLUME", 0.1);
    expect(crashScore.isAnomaly).toBe(true);
    expect(crashScore.severity).toBeGreaterThan(0.6);
  });

  it("should learn flash crash recovery pattern", () => {
    // Before crash: normal
    for (let i = 0; i < 15; i++) {
      detector.recordMagnitude(testMint, "PRICE", 0.5 + Math.random() * 0.1);
    }

    // Crash then recovery sequence
    const crashRecoverySeq = [
      "CRASH_DETECTED",
      "BUFFER_DEPLOYED",
      "RECOVERY_INITIATED",
      "PRICE_STABILIZED",
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < crashRecoverySeq.length - 1; j++) {
        detector.recordTransition(testMint, crashRecoverySeq[j], crashRecoverySeq[j + 1]);
      }
    }

    // Should predict recovery sequence
    const nextFromBuff = detector.predictNextAction(testMint);
    expect(nextFromBuff).not.toBeNull();
  });

  it("should distinguish bot activity from organic volume", () => {
    // Organic: high variance, natural distribution
    for (let i = 0; i < 25; i++) {
      const base = 0.5;
      const normal = base + (Math.random() - 0.5) * 0.3;
      detector.recordMagnitude(testMint, "ORGANIC", Math.max(0, Math.min(1, normal)));
    }

    // Bot-like: suspiciously consistent, low variance
    for (let i = 0; i < 25; i++) {
      detector.recordMagnitude(testMint, "BOT_LIKE", 0.5001 + Math.random() * 0.001);
    }

    const organicStats = detector.getPatternStats(testMint, "ORGANIC");
    const botStats = detector.getPatternStats(testMint, "BOT_LIKE");

    // Bot activity should have much lower std dev
    expect((botStats?.stdDev ?? 1) < (organicStats?.stdDev ?? 0)).toBe(true);
  });
});

describe("ML Pattern Detection: Integration with Havoc MM", () => {
  let detector: PatternDetector;
  const testMint = new PublicKey("MLTestMintIntegrationxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    detector = new PatternDetector();
  });

  it("should provide anomaly-triggered MM action recommendation", () => {
    // Build normal distribution
    for (let i = 0; i < 40; i++) {
      detector.recordMagnitude(testMint, "SPREAD", 0.4 + Math.random() * 0.1);
    }

    // Record anomaly
    const anomalyScore = detector.getAnomalyScore(testMint, "SPREAD", 0.95);

    // High severity + high confidence → should trigger SPREAD_COMPRESSION
    const shouldCompress =
      anomalyScore.severity > 0.6 && anomalyScore.confidence > 0.5 && anomalyScore.isAnomaly;

    expect(shouldCompress).toBe(true);
  });

  it("should predict action sequence for coordinated response", () => {
    const actionSeq = ["VOLUME_SPIKE", "SPREAD_WIDENING", "CRASH_BUFFERING"];

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < actionSeq.length - 1; j++) {
        detector.recordTransition(testMint, actionSeq[j], actionSeq[j + 1]);
      }
    }

    const forecast = detector.forecastMagnitude(testMint, "CHAOS_LEVEL", 2);
    const nextAction = detector.predictNextAction(testMint);

    expect(forecast).not.toBeNull();
    expect(nextAction).not.toBeNull();
    expect(["VOLUME_SPIKE", "SPREAD_WIDENING", "CRASH_BUFFERING"]).toContain(nextAction);
  });
});
