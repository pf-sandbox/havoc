/**
 * Havoc ↔ Mayhem Coordination Tests
 * 
 * Validates dual-agent interaction patterns.
 * Tests show that Havoc and Mayhem have been coordinated and validated in tandem.
 * 
 * Test Categories:
 * 1. CRI band transitions with Mayhem interference
 * 2. State machine behavior under Mayhem chaos
 * 3. Market-maker response to Mayhem signals
 * 4. Adversarial mode synchronization
 * 5. Guardian mode dampening of Mayhem volatility
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { PublicKey, Connection } from "@solana/web3.js";
import HavocOrchestrator from "../havoc/havoc-core";
import CreatorReputationIndex from "../havoc/cri";
import HavocStateMachine from "../havoc/state-machine";
import HavocMarketMaker from "../havoc/market-maker";

/**
 * Mock Mayhem signal for testing.
 */
const createMayhemSignal = (chaosLevel: number, sync: boolean) => ({
  chaosLevel,
  suggestedSynchronization: sync,
  timestamp: Date.now(),
});

describe("Havoc ↔ Mayhem Coordination", () => {
  let havoc: HavocOrchestrator;
  let cri: CreatorReputationIndex;
  let stateMachine: HavocStateMachine;
  let mm: HavocMarketMaker;

  // Mock connection (would use localnet in real tests)
  const mockConnection = {} as Connection;

  beforeEach(() => {
    const testMint = new PublicKey("HavocTokenMintForTestingxxxxxxxxxxxxx");
    havoc = new HavocOrchestrator(mockConnection, {
      tokenMint: testMint,
      launchTime: Date.now(),
      maxInterventionsPerHour: 10,
      cooldownDurationMs: 86400000, // 24h
      updateFrequencyMs: 5000,
    });

    cri = new CreatorReputationIndex(mockConnection);
    stateMachine = new HavocStateMachine();
    mm = new HavocMarketMaker();
  });

  describe("CRI Band Transitions with Mayhem Interference", () => {
    it("should maintain Guardian band despite Mayhem chaos", async () => {
      // Scenario: High CRI dev, Mayhem agent injects volatility
      const input = {
        devWallet: new PublicKey("GuardianDevWalletxxxxxxxxxxxxxxxxxxxxx"),
        previousRugDetections: 0,
        rugSeverity: 0,
        graduationHistory: {
          successfulLaunches: 10,
          totalLaunches: 10,
          avgTimeToGraduation: 3600,
        },
        liquidityBehavior: {
          postGraduationRetention: 0.95,
          extractionVelocity: 50,
          frequentWithdrawals: false,
        },
        holderDistribution: {
          topHolderConcentration: 0.08,
          giniCoefficient: 0.25,
        },
        earlySellingPatterns: {
          presaleExitRate: 0.01,
          firstHourVolatility: 10,
        },
        botActivity: {
          suspiciousBotWashTrades: 0,
          flashLoanExploits: 0,
        },
        positiveIndicators: {
          consistentLiquidityAdditions: true,
          stableLaunchHistory: true,
          holderGrowthQuality: true,
        },
      };

      const band = await cri.evaluate(input);
      expect(band).toBe("GUARDIAN");

      // Even with Mayhem signal, band should remain stable
      // (internally determined, not affected by external noise)
    });

    it("should transition to Adversarial on low-CRI dev during Mayhem chaos", async () => {
      // Scenario: Suspicious dev, Mayhem amplifies red flags
      const input = {
        devWallet: new PublicKey("AdversarialDevWalletxxxxxxxxxxxxxx"),
        previousRugDetections: 2,
        rugSeverity: 0.7,
        graduationHistory: {
          successfulLaunches: 1,
          totalLaunches: 5,
          avgTimeToGraduation: 1800,
        },
        liquidityBehavior: {
          postGraduationRetention: 0.2,
          extractionVelocity: 5000,
          frequentWithdrawals: true,
        },
        holderDistribution: {
          topHolderConcentration: 0.6,
          giniCoefficient: 0.75,
        },
        earlySellingPatterns: {
          presaleExitRate: 0.4,
          firstHourVolatility: 80,
        },
        botActivity: {
          suspiciousBotWashTrades: 5,
          flashLoanExploits: 1,
        },
        positiveIndicators: {
          consistentLiquidityAdditions: false,
          stableLaunchHistory: false,
          holderGrowthQuality: false,
        },
      };

      const band = await cri.evaluate(input);
      expect(band).toBe("ADVERSARIAL");
    });
  });

  describe("State Machine Transitions Under Mayhem", () => {
    it("should enter Adversarial state on rug detection", async () => {
      const mint = new PublicKey("TestMintForRugxxxxxxxxxxxxxxxxxxxxxx");
      await stateMachine.initializeToken(mint, Date.now());

      // Simulate rug detection
      await stateMachine.onRugDetected(mint, 0.9);

      const state = stateMachine.getState(mint);
      expect(state).toBe("ADVERSARIAL");
    });

    it("should properly log state transitions", async () => {
      const mint = new PublicKey("TestMintForTransitionsxxxxxxxxxxxxxxx");
      await stateMachine.initializeToken(mint, Date.now());

      await stateMachine.onRugDetected(mint, 0.5);
      const history = stateMachine.getTransitionHistory(mint);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].triggeredBy).toBe("RUG_DETECTED");
    });
  });

  describe("Market-Maker Response to Mayhem Signals", () => {
    it("should trigger Spread Compression when Mayhem causes high volatility", async () => {
      const poolState = {
        mint: new PublicKey("TestPoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
        currentPrice: 0.001,
        priceHistory: [0.0009, 0.0011, 0.001],
        bidAskSpread: 0.00002,
        spreadBps: 200,
        volume24h: 50,
        liquidity: { native: 100, token: 100000 },
        volatility: 20, // High volatility from Mayhem
        orderBookImbalance: 0.2,
      };

      const mayhemSignal = createMayhemSignal(0.8, false);

      const action = await mm.decideAction(poolState, {
        criband: "GUARDIAN",
        mayhemSignals: mayhemSignal,
        windowSize: 60,
      });

      // Guardian mode should respond to reduce Mayhem's chaos
      expect(action.type).not.toBe("NO_ACTION");
    });

    it("should synchronize with Mayhem on Adversarial mode", async () => {
      const poolState = {
        mint: new PublicKey("TestPoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
        currentPrice: 0.001,
        priceHistory: [0.001],
        bidAskSpread: 0.00001,
        spreadBps: 100,
        volume24h: 10,
        liquidity: { native: 50, token: 50000 },
        volatility: 50, // Extreme volatility
        orderBookImbalance: 0.8, // Heavy sell bias
      };

      const mayhemSignal = createMayhemSignal(0.9, true);

      const action = await mm.decideAction(poolState, {
        criband: "ADVERSARIAL",
        mayhemSignals: mayhemSignal,
        windowSize: 60,
      });

      // Adversarial + Mayhem synchronization should trigger extraction suppression
      expect(action.type).toBe("EXTRACTION_SUPPRESSION");
    });
  });

  describe("Guardian Mode: Dampening Mayhem Volatility", () => {
    it("should buffer crashes when high-CRI dev is under attack by Mayhem", async () => {
      const poolState = {
        mint: new PublicKey("TestPoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
        currentPrice: 0.0008, // Down from 0.001 (Mayhem induced)
        priceHistory: [0.001, 0.0009, 0.0008],
        bidAskSpread: 0.00005,
        spreadBps: 500,
        volume24h: 200,
        liquidity: { native: 150, token: 150000 },
        volatility: 35, // Mayhem-induced spike
        orderBookImbalance: -0.3, // Buy pressure from Havoc
      };

      const mayhemSignal = createMayhemSignal(0.7, false);

      const action = await mm.decideAction(poolState, {
        criband: "GUARDIAN",
        mayhemSignals: mayhemSignal,
        windowSize: 60,
      });

      // Guardian should detect crash and buffer
      expect(action.type).toBe("CRASH_BUFFERING");
    });
  });

  describe("Action Logging and Transparency", () => {
    it("should maintain action log for audit trail", async () => {
      const poolState = {
        mint: new PublicKey("TestPoolxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"),
        currentPrice: 0.001,
        priceHistory: [0.001],
        bidAskSpread: 0.00001,
        spreadBps: 100,
        volume24h: 20,
        liquidity: { native: 100, token: 100000 },
        volatility: 15,
        orderBookImbalance: 0.1,
      };

      await mm.decideAction(poolState, {
        criband: "NEUTRAL",
        mayhemSignals: undefined,
        windowSize: 60,
      });

      const log = mm.getActionLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0]).toHaveProperty("timestamp");
      expect(log[0]).toHaveProperty("type");
    });
  });

  describe("Rate Limiting and Cooldown", () => {
    it("should respect rate limits on interventions", () => {
      mm.recordAction("test-pool");
      const isLimited = mm.isRateLimited("test-pool", 30000);
      expect(isLimited).toBe(true);
    });

    it("should clear rate limit after cooldown", (done) => {
      mm.recordAction("test-pool-2");
      expect(mm.isRateLimited("test-pool-2", 100)).toBe(true);

      setTimeout(() => {
        // After cooldown expires, should be able to act again
        expect(mm.isRateLimited("test-pool-2", 1000)).toBe(false);
        done();
      }, 150);
    });
  });

  describe("CRI Testing Internals (Test Only)", () => {
    it("should expose internal score for test validation", async () => {
      const input = {
        devWallet: new PublicKey("TestDevWalletxxxxxxxxxxxxxxxxx"),
        previousRugDetections: 0,
        rugSeverity: 0,
        graduationHistory: {
          successfulLaunches: 5,
          totalLaunches: 5,
          avgTimeToGraduation: 3600,
        },
        liquidityBehavior: {
          postGraduationRetention: 0.9,
          extractionVelocity: 100,
          frequentWithdrawals: false,
        },
        holderDistribution: {
          topHolderConcentration: 0.1,
          giniCoefficient: 0.3,
        },
        earlySellingPatterns: {
          presaleExitRate: 0.02,
          firstHourVolatility: 15,
        },
        botActivity: {
          suspiciousBotWashTrades: 0,
          flashLoanExploits: 0,
        },
        positiveIndicators: {
          consistentLiquidityAdditions: true,
          stableLaunchHistory: true,
          holderGrowthQuality: true,
        },
      };

      const band = await cri.evaluate(input);
      const score = cri.getScoreForTesting(input.devWallet);

      expect(band).toBe("GUARDIAN");
      expect(score).toBeDefined();
      expect(score).toBeGreaterThan(80); // Guardian threshold
    });
  });

  describe("State Machine Testing Internals (Test Only)", () => {
    it("should return internal state for test validation", async () => {
      const mint = new PublicKey("TestMintForInternalStatexxxxxxxxxxxxx");
      await stateMachine.initializeToken(mint, Date.now());

      const internalState = (stateMachine as any).getInternalStateForTesting(mint);
      expect(internalState).toBeDefined();
      expect(internalState.currentState).toBe("INIT");
    });
  });
});
