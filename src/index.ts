import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { loadConfig, validateConfig, logConfig } from "./config";
import { detectMayhemMode } from "./mayhem-detector";
import { getPumpSwapPool } from "./pool";
import { logger } from "./utils/logger";
import { connection } from "./constants";
import { MayhemConfig } from "./types/config";

/**
 * HAVOC - Mayhem Mode v2 Orchestrator
 * Coordinates distributed wallet buy/sell cycles
 */

interface WalletState {
  wallet: Keypair;
  solBalance: number;
  tokenBalance: number;
  transactionCount: number;
}

class HAVOCOrchestrator {
  private config: MayhemConfig;
  private walletStates: Map<string, WalletState>;
  private startTime: number;
  private endTime: number;
  private poolAddress: PublicKey | null = null;

  constructor(config: MayhemConfig) {
    this.config = config;
    this.walletStates = new Map();
    this.startTime = Date.now();
    this.endTime = this.startTime + config.durationSeconds * 1000;

    // Initialize wallet states
    config.wallets.forEach((wallet) => {
      this.walletStates.set(wallet.publicKey.toBase58(), {
        wallet,
        solBalance: config.initialSolPerWallet,
        tokenBalance: 0,
        transactionCount: 0,
      });
    });
  }

  /**
   * Initialize and validate the system
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info("Initializing HAVOC...");

      // Validate configuration
      const validation = validateConfig(this.config);
      if (!validation.isValid) {
        logger.error("Configuration validation failed:");
        validation.errors.forEach((e) => logger.error(`  - ${e}`));
        return false;
      }

      if (validation.warnings.length > 0) {
        logger.warn("Configuration warnings:");
        validation.warnings.forEach((w) => logger.warn(`  - ${w}`));
      }

      // Log configuration
      logConfig(this.config);

      // Check connection
      const slot = await connection.getSlot();
      logger.info(`Connected to RPC at slot ${slot}`);

      // Find pool for token
      logger.info(`Looking up pool for token ${this.config.tokenMint.toBase58()}...`);
      this.poolAddress = await getPumpSwapPool(this.config.tokenMint);
      if (!this.poolAddress) {
        logger.error("Failed to find pool for token");
        return false;
      }
      logger.info(`Found pool: ${this.poolAddress.toBase58()}`);

      // Detect Mayhem Mode
      const mayhemStatus = await detectMayhemMode(connection, this.config.tokenMint, this.poolAddress);
      this.config.isMayhemMode = mayhemStatus.isMayhemMode;
      logger.info(
        `Token is using ${mayhemStatus.tokenProgram} with Mayhem=${mayhemStatus.isMayhemMode}`
      );

      // Log wallet addresses
      logger.info(`Initialized ${this.config.wallets.length} wallets:`)
      this.config.wallets.forEach((wallet, i) => {
        logger.info(`  Wallet ${i + 1}: ${wallet.publicKey.toBase58()}`);
      });

      // Check balances (in dry run mode, we still want to know what would happen)
      if (!this.config.dryRun) {
        await this.checkWalletBalances();
      }

      logger.info("Initialization complete!");
      return true;
    } catch (error) {
      logger.error(`Initialization failed: ${error}`);
      return false;
    }
  }

  /**
   * Check current SOL balances of all wallets
   */
  private async checkWalletBalances(): Promise<void> {
    logger.info("Checking wallet balances...");
    for (const wallet of this.config.wallets) {
      const balance = await connection.getBalance(wallet.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      logger.info(`  ${wallet.publicKey.toBase58()}: ${solBalance.toFixed(4)} SOL`);
    }
  }

  /**
   * Run the main orchestration loop
   */
  async run(): Promise<void> {
    logger.info("Starting HAVOC orchestration loop...");
    logger.info(`Duration: ${this.config.durationSeconds} seconds`);

    if (this.config.dryRun) {
      logger.warn("DRY RUN MODE - No transactions will be sent");
      await this.simulateRun();
    } else {
      await this.executeRun();
    }
  }

  /**
   * Simulate the run without sending transactions (for testing)
   */
  private async simulateRun(): Promise<void> {
    logger.info("Starting DRY RUN simulation...");

    const startTime = Date.now();
    let iterations = 0;

    while (Date.now() - startTime < 10000) { // 10 second demo
      iterations++;

      for (const walletState of this.walletStates.values()) {
        // Simulate random buy/sell decisions
        const action = Math.random() > 0.5 ? "BUY" : "SELL";
        const amount = Math.random() * this.config.buyUpperPercent;

        logger.info(
          `[DRY] ${walletState.wallet.publicKey.toBase58().slice(0, 8)}... ${action} ${amount.toFixed(2)}%`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info(`Dry run completed: ${iterations} iterations`);
    logger.info(`Simulated ${this.config.wallets.length} wallets`);
  }

  /**
   * Execute the actual run with real transactions
   */
  private async executeRun(): Promise<void> {
    logger.info("Starting ACTUAL execution...");
    logger.info("WARNING: Real transactions will be sent!");

    // This will be implemented in phase 2-3
    // For now, we'll just run simulation logic
    await this.simulateRun();
  }

  /**
   * Get runtime statistics
   */
  getStats(): {
    elapsedSeconds: number;
    remainingSeconds: number;
    totalTransactions: number;
    walletCount: number;
  } {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.startTime) / 1000);
    const remainingSeconds = Math.floor((this.endTime - now) / 1000);

    return {
      elapsedSeconds,
      remainingSeconds,
      totalTransactions: Array.from(this.walletStates.values()).reduce(
        (sum, ws) => sum + ws.transactionCount,
        0
      ),
      walletCount: this.config.wallets.length,
    };
  }

  /**
   * Print summary statistics
   */
  printStats(): void {
    const stats = this.getStats();
    logger.info("=== HAVOC Stats ===");
    logger.info(`Elapsed: ${stats.elapsedSeconds}s / ${this.config.durationSeconds}s`);
    logger.info(`Remaining: ${stats.remainingSeconds}s`);
    logger.info(`Total Transactions: ${stats.totalTransactions}`);
    logger.info(`Active Wallets: ${stats.walletCount}`);
    logger.info("==================");
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = loadConfig();

    // Create orchestrator
    const havoc = new HAVOCOrchestrator(config);

    // Initialize
    const initialized = await havoc.initialize();
    if (!initialized) {
      logger.error("Failed to initialize HAVOC");
      process.exit(1);
    }

    // Run orchestration
    await havoc.run();

    // Print final stats
    havoc.printStats();

    logger.info("HAVOC orchestration complete");
  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main().catch((error) => {
    logger.error(`Unhandled error: ${error}`);
    process.exit(1);
  });
}

export { HAVOCOrchestrator };
