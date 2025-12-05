import { Keypair, PublicKey } from "@solana/web3.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { retrieveEnvVariable } from "./utils/utils";
import { logger } from "./utils/logger";
import { MayhemConfig, ConfigValidationResult } from "./types/config";

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): MayhemConfig {
  const tokenMintStr = retrieveEnvVariable("TOKEN_MINT", logger);
  const buyLowerPercent = parseFloat(retrieveEnvVariable("BUY_LOWER_PERCENT", logger) || "10");
  const buyUpperPercent = parseFloat(retrieveEnvVariable("BUY_UPPER_PERCENT", logger) || "30");
  const buyIntervalMin = parseInt(retrieveEnvVariable("BUY_INTERVAL_MIN", logger) || "30");
  const buyIntervalMax = parseInt(retrieveEnvVariable("BUY_INTERVAL_MAX", logger) || "120");
  const sellIntervalMin = parseInt(retrieveEnvVariable("SELL_INTERVAL_MIN", logger) || "60");
  const sellIntervalMax = parseInt(retrieveEnvVariable("SELL_INTERVAL_MAX", logger) || "300");
  const walletCount = parseInt(retrieveEnvVariable("DISTRIBUTE_WALLET_NUM", logger) || "5");
  const slippage = parseFloat(retrieveEnvVariable("SLIPPAGE", logger) || "1.0");
  const priorityFeeUicroLamports = parseInt(retrieveEnvVariable("PRIORITY_FEE_MICROLAMPORTS", logger) || "696969");
  const computeUnits = parseInt(retrieveEnvVariable("COMPUTE_UNITS", logger) || "300000");
  const durationSeconds = parseInt(retrieveEnvVariable("DURATION_SECONDS", logger) || "86400"); // 24 hours default
  const dryRun = retrieveEnvVariable("DRY_RUN", logger)?.toLowerCase() === "true";
  const privateKey = retrieveEnvVariable("PRIVATE_KEY", logger);
  const initialSolPerWallet = parseFloat(retrieveEnvVariable("INITIAL_SOL_PER_WALLET", logger) || "0.5");

  // Parse relay provider settings
  const relays = {
    jito: retrieveEnvVariable("USE_JITO", logger)?.toLowerCase() !== "false",
    nozomi: retrieveEnvVariable("USE_NOZOMI", logger)?.toLowerCase() !== "false",
    slot0: retrieveEnvVariable("USE_0SLOT", logger)?.toLowerCase() !== "false",
    blockrazor: retrieveEnvVariable("USE_BLOCKRAZOR", logger)?.toLowerCase() !== "false",
    bloxroute: retrieveEnvVariable("USE_BLOXROUTE", logger)?.toLowerCase() !== "false",
  };

  // Create wallets
  let wallets: Keypair[] = [];
  const creatorKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));

  // Check if wallet list is provided
  const walletListStr = process.env.WALLET_LIST;
  if (walletListStr) {
    try {
      const walletAddresses = JSON.parse(walletListStr);
      wallets = walletAddresses.map((addr: string) => Keypair.fromSecretKey(bs58.decode(addr)));
    } catch (e) {
      logger.warn("Failed to parse WALLET_LIST, generating new wallets");
    }
  }

  // Generate missing wallets
  while (wallets.length < walletCount) {
    wallets.push(Keypair.generate());
  }

  const config: MayhemConfig = {
    tokenMint: new PublicKey(tokenMintStr),
    isMayhemMode: false, // Will be detected from blockchain
    walletCount,
    wallets: wallets.slice(0, walletCount),
    initialSolPerWallet,
    buyLowerPercent,
    buyUpperPercent,
    buyIntervalMin,
    buyIntervalMax,
    sellIntervalMin,
    sellIntervalMax,
    slippage,
    priorityFeeUicroLamports,
    computeUnits,
    relays,
    durationSeconds,
    dryRun,
  };

  return config;
}

/**
 * Validate the configuration
 */
export function validateConfig(config: MayhemConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Token validation
  if (!config.tokenMint) {
    errors.push("TOKEN_MINT is required");
  }

  // Wallet validation
  if (config.walletCount < 1) {
    errors.push("DISTRIBUTE_WALLET_NUM must be at least 1");
  }
  if (config.wallets.length !== config.walletCount) {
    errors.push(`Expected ${config.walletCount} wallets but got ${config.wallets.length}`);
  }

  // Buy parameters validation
  if (config.buyLowerPercent < 0 || config.buyLowerPercent > 100) {
    errors.push("BUY_LOWER_PERCENT must be between 0 and 100");
  }
  if (config.buyUpperPercent < 0 || config.buyUpperPercent > 100) {
    errors.push("BUY_UPPER_PERCENT must be between 0 and 100");
  }
  if (config.buyLowerPercent > config.buyUpperPercent) {
    errors.push("BUY_LOWER_PERCENT must be <= BUY_UPPER_PERCENT");
  }

  // Interval validation
  if (config.buyIntervalMin < 0 || config.buyIntervalMax < 0) {
    errors.push("Buy intervals must be non-negative");
  }
  if (config.buyIntervalMin > config.buyIntervalMax) {
    errors.push("BUY_INTERVAL_MIN must be <= BUY_INTERVAL_MAX");
  }
  if (config.sellIntervalMin < 0 || config.sellIntervalMax < 0) {
    errors.push("Sell intervals must be non-negative");
  }
  if (config.sellIntervalMin > config.sellIntervalMax) {
    errors.push("SELL_INTERVAL_MIN must be <= SELL_INTERVAL_MAX");
  }

  // Slippage validation
  if (config.slippage < 0 || config.slippage > 100) {
    errors.push("SLIPPAGE must be between 0 and 100");
  }

  // Priority fee validation
  if (config.priorityFeeUicroLamports < 0) {
    errors.push("PRIORITY_FEE_MICROLAMPORTS must be non-negative");
  }

  // Compute units validation
  if (config.computeUnits < 1000 || config.computeUnits > 1_400_000) {
    warnings.push("COMPUTE_UNITS is outside typical range (1000-1400000)");
  }

  // Duration validation
  if (config.durationSeconds < 60) {
    warnings.push("DURATION_SECONDS is less than 1 minute");
  }
  if (config.durationSeconds > 604800) {
    warnings.push("DURATION_SECONDS is more than 1 week");
  }

  // Relay validation
  const relayCount = Object.values(config.relays).filter(Boolean).length;
  if (relayCount === 0) {
    warnings.push("No relay providers enabled - will use standard RPC");
  }

  // Dry run warning
  if (config.dryRun) {
    warnings.push("DRY_RUN is enabled - no transactions will be sent");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log configuration details
 */
export function logConfig(config: MayhemConfig): void {
  logger.info("=== HAVOC Configuration ===");
  logger.info(`Token Mint: ${config.tokenMint.toBase58()}`);
  logger.info(`Wallet Count: ${config.walletCount}`);
  logger.info(`Initial SOL per Wallet: ${config.initialSolPerWallet}`);
  logger.info(`Buy Range: ${config.buyLowerPercent}% - ${config.buyUpperPercent}%`);
  logger.info(`Buy Interval: ${config.buyIntervalMin}s - ${config.buyIntervalMax}s`);
  logger.info(`Sell Interval: ${config.sellIntervalMin}s - ${config.sellIntervalMax}s`);
  logger.info(`Slippage: ${config.slippage}%`);
  logger.info(`Priority Fee: ${config.priorityFeeUicroLamports} microlamports`);
  logger.info(`Compute Units: ${config.computeUnits}`);
  logger.info(`Duration: ${config.durationSeconds}s (${(config.durationSeconds / 3600).toFixed(1)} hours)`);
  logger.info(`Relays: ${Object.entries(config.relays).filter(([, v]) => v).map(([k]) => k).join(", ")}`);
  if (config.dryRun) {
    logger.warn("DRY_RUN MODE ENABLED - No transactions will be sent");
  }
  logger.info("===========================");
}
