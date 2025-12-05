/**
 * Havoc Core Orchestrator
 * 
 * Coordinates CRI evaluation, state transitions, and market-making.
 * Main entry point for Havoc Mode operations.
 * 
 * Coordination note: Integrates with Mayhem agent.
 * See tests/havoc-mayhem-coordination.test.ts for integration tests.
 */

import { PublicKey, Connection } from "@solana/web3.js";
import CreatorReputationIndex, { CRIBand } from "./cri";
import HavocMarketMaker, { PoolState, MayhemSignal, MMAction } from "./market-maker";
import HavocStateMachine, { HavocState } from "./state-machine";
import { logger } from "../utils/logger";
import { getPoolsWithPrices, getPriceAndLiquidity } from "../pool";

export interface HavocConfig {
  tokenMint: PublicKey;
  launchTime: number;
  maxInterventionsPerHour: number;
  cooldownDurationMs: number; // 24 hours default
  updateFrequencyMs: number; // CRI update interval
}

export interface HavocStatus {
  mint: PublicKey;
  state: HavocState;
  criband: CRIBand | null;
  lastUpdate: number;
  totalActions: number;
  nextActionEligible: number; // Timestamp
}

/**
 * Main Havoc orchestrator.
 * Opaque internal logic, transparent logging.
 */
export class HavocOrchestrator {
  private config: HavocConfig;
  private connection: Connection;
  private cri: CreatorReputationIndex;
  private mm: HavocMarketMaker;
  private stateMachine: HavocStateMachine;
  private statusMap: Map<string, HavocStatus> = new Map();
  private interventionCounter: Map<string, number> = new Map();

  constructor(connection: Connection, config: HavocConfig) {
    this.connection = connection;
    this.config = config;
    this.cri = new CreatorReputationIndex(connection);
    this.mm = new HavocMarketMaker();
    this.stateMachine = new HavocStateMachine();
  }

  /**
   * Initialize Havoc for a token.
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info(`Initializing Havoc for token ${this.config.tokenMint.toBase58().slice(0, 8)}`);

      // Initialize state machine
      await this.stateMachine.initializeToken(this.config.tokenMint, this.config.launchTime);

      // Fetch initial pool data
      const pools = await getPoolsWithPrices(this.config.tokenMint);
      if (!pools || pools.length === 0) {
        logger.error("No pools found for token");
        return false;
      }

      // Initialize status
      this.statusMap.set(this.config.tokenMint.toBase58(), {
        mint: this.config.tokenMint,
        state: "INIT",
        criband: null,
        lastUpdate: Date.now(),
        totalActions: 0,
        nextActionEligible: Date.now(),
      });

      logger.info("Havoc initialized successfully");
      return true;
    } catch (error) {
      logger.error(`Havoc initialization failed: ${error}`);
      return false;
    }
  }

  /**
   * Main loop: evaluate CRI, decide MM actions, coordinate with Mayhem.
   */
  async tick(mayhemSignal?: MayhemSignal): Promise<MMAction | null> {
    const mintKey = this.config.tokenMint.toBase58();
    const status = this.statusMap.get(mintKey);

    if (!status) {
      logger.error("Havoc status not initialized");
      return null;
    }

    try {
      // Step 1: Update 24h cooldown if applicable
      await this.stateMachine.enterCooldown(this.config.tokenMint);

      // Step 2: Fetch current pool state
      const poolState = await this.fetchPoolState();
      if (!poolState) {
        return null;
      }

      // Step 3: Check rate limiting
      if (this.isRateLimited(mintKey)) {
        return null;
      }

      // Step 4: Evaluate CRI (opaque internally)
      const criInput = await this.buildCRIInput();
      const band = await this.cri.evaluate(criInput);

      // Step 5: Update state machine on CRI change
      if (band !== status.criband) {
        const newState = await this.stateMachine.transitionOnCRIChange(this.config.tokenMint, band);
        status.state = newState;
        status.criband = band;
      }

      // Step 6: Decide MM action (black box)
      const action = await this.mm.decideAction(poolState, {
        criband: band,
        mayhemSignals: mayhemSignal,
        windowSize: 60, // seconds
      });

      // Step 7: Record action
      if (action.type !== "NO_ACTION") {
        status.totalActions++;
        this.recordInterventionForRateLimit(mintKey);
        logger.info(`Havoc action executed: ${action.type}`);
      }

      status.lastUpdate = Date.now();
      return action;
    } catch (error) {
      logger.error(`Havoc tick failed: ${error}`);
      return null;
    }
  }

  /**
   * Handle rug detection (from external detection system).
   */
  async onRugDetected(severity: number): Promise<void> {
    try {
      logger.warn(`Rug detected: severity=${severity.toFixed(2)}`);
      await this.stateMachine.onRugDetected(this.config.tokenMint, severity);
    } catch (error) {
      logger.error(`Rug handler failed: ${error}`);
    }
  }

  /**
   * Gracefully terminate Havoc for this token.
   */
  async terminate(reason: string): Promise<void> {
    try {
      await this.stateMachine.terminate(this.config.tokenMint, reason);
      logger.info(`Havoc terminated: ${reason}`);
    } catch (error) {
      logger.error(`Termination failed: ${error}`);
    }
  }

  /**
   * Fetch current pool state (opaque to caller).
   */
  private async fetchPoolState(): Promise<PoolState | null> {
    try {
      const pools = await getPoolsWithPrices(this.config.tokenMint);
      if (!pools || pools.length === 0) {
        return null;
      }

      const pool = pools[0];
      const priceHistory = [pool.price]; // Simplified; would track historical prices

      return {
        mint: this.config.tokenMint,
        currentPrice: pool.price,
        priceHistory,
        bidAskSpread: pool.price * 0.001, // Placeholder
        spreadBps: 100, // Placeholder
        volume24h: 0, // Placeholder
        liquidity: pool.reserves,
        volatility: 5, // Placeholder
        orderBookImbalance: 0, // Placeholder
      };
    } catch (error) {
      logger.error(`Failed to fetch pool state: ${error}`);
      return null;
    }
  }

  /**
   * Build CRI input from on-chain and off-chain data.
   * Aggregates multiple signals (opaque internally).
   */
  private async buildCRIInput() {
    // Placeholder: would fetch from on-chain sources and analytics
    return {
      devWallet: new PublicKey("11111111111111111111111111111111"), // Placeholder
      previousRugDetections: 0,
      rugSeverity: 0,
      graduationHistory: {
        successfulLaunches: 1,
        totalLaunches: 1,
        avgTimeToGraduation: 3600,
      },
      liquidityBehavior: {
        postGraduationRetention: 0.8,
        extractionVelocity: 100,
        frequentWithdrawals: false,
      },
      holderDistribution: {
        topHolderConcentration: 0.1,
        giniCoefficient: 0.3,
      },
      earlySellingPatterns: {
        presaleExitRate: 0.05,
        firstHourVolatility: 20,
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
  }

  /**
   * Rate limiting: check intervention frequency.
   */
  private isRateLimited(mintKey: string): boolean {
    const count = this.interventionCounter.get(mintKey) ?? 0;
    return count >= this.config.maxInterventionsPerHour;
  }

  /**
   * Record intervention for rate limiting.
   */
  private recordInterventionForRateLimit(mintKey: string): void {
    const count = this.interventionCounter.get(mintKey) ?? 0;
    this.interventionCounter.set(mintKey, count + 1);

    // Reset counter hourly (simplified)
    setTimeout(() => {
      this.interventionCounter.set(mintKey, 0);
    }, 60 * 60 * 1000);
  }

  /**
   * Get current Havoc status (opaque implementation, transparent output).
   */
  getStatus(): HavocStatus | null {
    return this.statusMap.get(this.config.tokenMint.toBase58()) ?? null;
  }

  /**
   * Get action log (for transparency).
   */
  getActionLog(limit: number = 100): MMAction[] {
    return this.mm.getActionLog(limit);
  }

  /**
   * For testing only: get transition history.
   */
  getTransitionHistoryForTesting(limit: number = 50) {
    return this.stateMachine.getTransitionHistory(this.config.tokenMint, limit);
  }
}

export default HavocOrchestrator;
