/**
 * Pool Integration Layer
 * 
 * Connects Havoc to existing pool.ts utilities.
 * Fetches pool state, calculates prices, bridges to transaction execution.
 * 
 * Design notes:
 * - Caches pool state to reduce RPC calls
 * - Maintains 100-entry price history for volatility calculations
 * - Trade simulation uses constant-product bonding curve formula
 */

import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getPoolsWithPrices, getPriceAndLiquidity, PoolWithPrice } from "../pool";
import { logger } from "../utils/logger";

export interface HavocPoolState {
  mint: PublicKey;
  poolAddress: PublicKey;
  currentPrice: number;
  priceHistory: number[];
  liquidity: {
    native: number; // SOL
    token: number;
  };
  reserves: {
    sol: bigint;
    token: bigint;
  };
  bidAskSpread: number;
  spreadBps: number;
  volume24h: number;
  volatility: number;
  lastUpdate: number;
}

/**
 * Wraps pool.ts utilities and enriches with Havoc-specific calculations.
 */
export class PoolIntegration {
  private connection: Connection;
  private poolCache: Map<string, HavocPoolState> = new Map();
  private priceHistory: Map<string, number[]> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Fetch current pool state for a token.
   * Returns Havoc-enriched pool data.
   */
  async getPoolState(mint: PublicKey): Promise<HavocPoolState | null> {
    const mintKey = mint.toBase58();

    try {
      // Fetch from existing pool utilities
      const pools = await getPoolsWithPrices(mint);

      if (!pools || pools.length === 0) {
        logger.warn(`No pools found for ${mintKey}`);
        return null;
      }

      const pool = pools[0];
      const poolAddress = pool.address;

      // Calculate volatility from price history
      const history = this.priceHistory.get(mintKey) ?? [];
      const volatility = this.calculateVolatility(history);

      // Build state
      const state: HavocPoolState = {
        mint,
        poolAddress,
        currentPrice: pool.price,
        priceHistory: [...history, pool.price].slice(-100),
        liquidity: pool.reserves,
        reserves: {
          sol: BigInt(Math.floor(pool.reserves.native * LAMPORTS_PER_SOL)),
          token: BigInt(Math.floor(pool.reserves.token * 1e6)),
        },
        bidAskSpread: pool.price * 0.001, // Estimate (would fetch from order book)
        spreadBps: 100, // Estimate
        volume24h: 0, // Placeholder
        volatility,
        lastUpdate: Date.now(),
      };

      // Update cache and history
      this.poolCache.set(mintKey, state);
      this.priceHistory.set(mintKey, state.priceHistory);

      return state;
    } catch (error) {
      logger.error(`Failed to get pool state for ${mintKey}: ${error}`);
      return null;
    }
  }

  /**
   * Calculate volatility from price history.
   * Returns % change over window.
   */
  private calculateVolatility(history: number[]): number {
    if (history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];

    if (oldest === 0) return 0;

    return Math.abs((newest - oldest) / oldest) * 100;
  }

  /**
   * Get cached pool state (no RPC call).
   */
  getCachedPoolState(mint: PublicKey): HavocPoolState | null {
    return this.poolCache.get(mint.toBase58()) ?? null;
  }

  /**
   * Simulate a trade on the bonding curve.
   * Used to predict slippage before execution.
   */
  async simulateTrade(
    mint: PublicKey,
    inputAmount: bigint,
    isBuy: boolean
  ): Promise<{ outputAmount: bigint; price: number; slippage: number } | null> {
    try {
      const state = await this.getPoolState(mint);
      if (!state) return null;

      const solReserve = state.reserves.sol;
      const tokenReserve = state.reserves.token;
      const product = solReserve * tokenReserve;

      let outputAmount: bigint;
      let newReserve: bigint;

      if (isBuy) {
        // Buy: input SOL, output tokens
        const newSolReserve = solReserve + inputAmount;
        const newTokenReserve = product / newSolReserve + 1n;
        outputAmount = tokenReserve - newTokenReserve;
        newReserve = newSolReserve;
      } else {
        // Sell: input tokens, output SOL
        const newTokenReserve = tokenReserve + inputAmount;
        const newSolReserve = product / newTokenReserve + 1n;
        outputAmount = solReserve - newSolReserve;
        newReserve = newTokenReserve;
      }

      // Calculate effective price and slippage
      const effectivePrice = isBuy
        ? Number(inputAmount) / Number(outputAmount)
        : Number(outputAmount) / Number(inputAmount);

      const slippage = Math.abs(effectivePrice - state.currentPrice) / state.currentPrice;

      return {
        outputAmount,
        price: effectivePrice,
        slippage: slippage * 100, // %
      };
    } catch (error) {
      logger.error(`Trade simulation failed: ${error}`);
      return null;
    }
  }

  /**
   * Get pool address for a token.
   */
  async getPoolAddress(mint: PublicKey): Promise<PublicKey | null> {
    try {
      const pools = await getPoolsWithPrices(mint);
      return pools && pools.length > 0 ? pools[0].address : null;
    } catch (error) {
      logger.error(`Failed to get pool address: ${error}`);
      return null;
    }
  }

  /**
   * Clear cache (for testing/refresh).
   */
  clearCache(): void {
    this.poolCache.clear();
    this.priceHistory.clear();
    logger.debug("Pool cache cleared");
  }

  /**
   * Get price history for analysis.
   */
  getPriceHistory(mint: PublicKey, limit: number = 100): number[] {
    const history = this.priceHistory.get(mint.toBase58()) ?? [];
    return history.slice(-limit);
  }
}

export default PoolIntegration;
