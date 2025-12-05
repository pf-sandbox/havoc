/**
 * Liquidity Management Layer
 * 
 * Handles micro-LP injection, spread bridging, and momentum-aware LP curves.
 * Executes on-chain liquidity adjustments based on MM decisions.
 * 
 * Implementation notes:
 * - All orders recorded for audit trail and performance metrics
 * - Budget resets hourly to prevent over-deployment
 * - Rate limiting per block to avoid transaction congestion
 */

import { PublicKey, Connection, TransactionInstruction } from "@solana/web3.js";
import { CRIBand } from "./cri";
import { logger } from "../utils/logger";

export interface LiquidityOrder {
  side: "buy" | "sell";
  amount: number; // Token amount
  price: number;
  priority: "low" | "normal" | "high";
  timestamp: number;
}

export interface LiquidityBudget {
  totalBudgetSol: number;
  usedSol: number;
  hourlyRemaining: number;
  blockCap: number;
  blockUsed: number;
}

export interface SpreadTarget {
  minBps: number; // Minimum acceptable spread
  maxBps: number; // Maximum before compression needed
  currentBps: number;
  targetBps: number;
}

/**
 * Manages all on-chain liquidity operations for Havoc.
 * Respects budgets, rate limits, and momentum conditions.
 */
export class LiquidityManager {
  private connection: Connection;
  private budgets: Map<string, LiquidityBudget> = new Map();
  private orderHistory: Map<string, LiquidityOrder[]> = new Map();
  private lastBlockTimestamp: Map<string, number> = new Map();

  constructor(connection: Connection, maxHourlyBudgetSol: number = 10) {
    this.connection = connection;
  }

  /**
   * Inject micro-liquidity to compress spread.
   * Executes buy/sell orders to tighten bid-ask gap.
   */
  async compressSpread(
    mint: PublicKey,
    poolState: { spreadBps: number; liquidity: { native: number } },
    criband: CRIBand
  ): Promise<LiquidityOrder[]> {
    const mintKey = mint.toBase58();

    try {
      // Determine spread target based on CRI band
      const target = this.getSpreadTarget(criband);

      if (poolState.spreadBps <= target.minBps) {
        logger.debug(`Spread already tight: ${poolState.spreadBps} bps`);
        return [];
      }

      // Calculate required orders to bridge gap
      const orders = this.calculateBridgingOrders(poolState, target);

      // Check budget and rate limits
      if (!this.canExecute(mintKey, orders)) {
        logger.warn(`Rate limit or budget constraint hit for ${mintKey}`);
        return [];
      }

      // Record orders (would execute on-chain in production)
      this.recordOrders(mintKey, orders);
      logger.info(`Spread compression: ${poolState.spreadBps} → ${target.targetBps} bps`);

      return orders;
    } catch (error) {
      logger.error(`Spread compression failed: ${error}`);
      return [];
    }
  }

  /**
   * Deploy micro-LP to absorb volume spikes.
   */
  async smoothVolume(
    mint: PublicKey,
    volumeAnomaly: number, // % above baseline
    criband: CRIBand
  ): Promise<LiquidityOrder[]> {
    const mintKey = mint.toBase58();

    try {
      if (volumeAnomaly < 15) {
        return []; // Only smooth significant anomalies
      }

      // Scale liquidity deployment by CRI band
      const deploymentScale = criband === "GUARDIAN" ? 1.0 : criband === "NEUTRAL" ? 0.6 : 0.2;
      const deploymentAmount = (volumeAnomaly / 100) * deploymentScale;

      const orders: LiquidityOrder[] = [
        {
          side: "buy",
          amount: deploymentAmount,
          price: 0, // Market price
          priority: "high",
          timestamp: Date.now(),
        },
      ];

      if (this.canExecute(mintKey, orders)) {
        this.recordOrders(mintKey, orders);
        logger.info(`Volume smoothing: deployed ${deploymentAmount.toFixed(2)} tokens`);
        return orders;
      }

      return [];
    } catch (error) {
      logger.error(`Volume smoothing failed: ${error}`);
      return [];
    }
  }

  /**
   * Add extraction friction by placing limit orders.
   * Used in Adversarial mode to slow suspicious exits.
   */
  async applyExtractionFriction(
    mint: PublicKey,
    currentPrice: number,
    severity: number // 0-1
  ): Promise<LiquidityOrder[]> {
    try {
      // Scale friction by severity
      const frictionPriceOffset = currentPrice * severity * 0.01; // 0-1% offset

      const orders: LiquidityOrder[] = [
        {
          side: "buy",
          amount: 1, // Small counterbalance
          price: currentPrice - frictionPriceOffset,
          priority: "normal",
          timestamp: Date.now(),
        },
      ];

      logger.debug(`Extraction friction applied: ${severity.toFixed(2)}`);
      return orders;
    } catch (error) {
      logger.error(`Extraction friction failed: ${error}`);
      return [];
    }
  }

  /**
   * Build momentum-aware LP curve.
   * Adjusts curve steepness based on CRI and volume.
   */
  buildMomentumAwareCurve(
    mint: PublicKey,
    criband: CRIBand,
    recentVolume: number
  ): { bips: number[] } {
    // Placeholder: would calculate LP curve steepness
    // Guardian: steep (more capital efficient)
    // Neutral: medium
    // Adversarial: flat (more conservative)

    const steepness =
      criband === "GUARDIAN" ? 300 : criband === "NEUTRAL" ? 200 : 100;

    return {
      bips: Array(5).fill(steepness),
    };
  }

  /**
   * Get spread target based on creator band.
   */
  private getSpreadTarget(criband: CRIBand): SpreadTarget {
    if (criband === "GUARDIAN") {
      return { minBps: 10, maxBps: 100, currentBps: 0, targetBps: 25 };
    } else if (criband === "NEUTRAL") {
      return { minBps: 25, maxBps: 200, currentBps: 0, targetBps: 75 };
    } else {
      return { minBps: 50, maxBps: 300, currentBps: 0, targetBps: 150 };
    }
  }

  /**
   * Calculate orders needed to bridge spread gap.
   */
  private calculateBridgingOrders(
    poolState: { spreadBps: number; liquidity: { native: number } },
    target: SpreadTarget
  ): LiquidityOrder[] {
    const orders: LiquidityOrder[] = [];

    // Simple bridging: buy and sell at midpoint
    const bridgeAmount = (poolState.liquidity.native * 0.1) / 2; // 10% of reserves

    orders.push({
      side: "buy",
      amount: bridgeAmount,
      price: 0, // Market
      priority: "high",
      timestamp: Date.now(),
    });

    orders.push({
      side: "sell",
      amount: bridgeAmount,
      price: 0, // Market
      priority: "high",
      timestamp: Date.now(),
    });

    return orders;
  }

  /**
   * Check if orders can be executed (budget, rate limits).
   */
  private canExecute(mintKey: string, orders: LiquidityOrder[]): boolean {
    const budget = this.budgets.get(mintKey);
    if (!budget) {
      return true; // No budget set, allow
    }

    // Check hourly budget
    const totalCost = orders.reduce((sum, o) => sum + o.amount, 0);
    if (budget.usedSol + totalCost > budget.totalBudgetSol) {
      return false;
    }

    // Check block cap
    if (budget.blockUsed >= budget.blockCap) {
      return false;
    }

    return true;
  }

  /**
   * Record orders in history.
   */
  private recordOrders(mintKey: string, orders: LiquidityOrder[]): void {
    const history = this.orderHistory.get(mintKey) ?? [];
    history.push(...orders);
    this.orderHistory.set(mintKey, history.slice(-10000));

    // Update budget
    const budget = this.budgets.get(mintKey);
    if (budget) {
      const cost = orders.reduce((sum, o) => sum + o.amount, 0);
      budget.usedSol += cost;
      budget.blockUsed += orders.length;
    }
  }

  /**
   * Get order history (for dashboard/testing).
   */
  getOrderHistory(mint: PublicKey, limit: number = 100): LiquidityOrder[] {
    const history = this.orderHistory.get(mint.toBase58()) ?? [];
    return history.slice(-limit);
  }

  /**
   * Set hourly budget.
   */
  setBudget(mint: PublicKey, budgetSol: number, blockCap: number = 5): void {
    this.budgets.set(mint.toBase58(), {
      totalBudgetSol: budgetSol,
      usedSol: 0,
      hourlyRemaining: budgetSol,
      blockCap,
      blockUsed: 0,
    });
  }

  /**
   * Get remaining budget.
   */
  getBudget(mint: PublicKey): LiquidityBudget | null {
    return this.budgets.get(mint.toBase58()) ?? null;
  }

  /**
   * Reset budget at hourly interval.
   */
  resetHourlyBudget(mint: PublicKey): void {
    const budget = this.budgets.get(mint.toBase58());
    if (budget) {
      budget.usedSol = 0;
      budget.blockUsed = 0;
      logger.debug(`Budget reset for ${mint.toBase58().slice(0, 8)}`);
    }
  }
}

export default LiquidityManager;
