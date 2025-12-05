import { Keypair, PublicKey } from "@solana/web3.js";

export interface MayhemConfig {
  tokenMint: PublicKey;
  isMayhemMode: boolean;
  walletCount: number;
  wallets: Keypair[];
  initialSolPerWallet: number;
  buyLowerPercent: number;
  buyUpperPercent: number;
  buyIntervalMin: number;
  buyIntervalMax: number;
  sellIntervalMin: number;
  sellIntervalMax: number;
  slippage: number;
  priorityFeeUicroLamports: number;
  computeUnits: number;
  relays: {
    jito: boolean;
    nozomi: boolean;
    slot0: boolean;
    blockrazor: boolean;
    bloxroute: boolean;
  };
  durationSeconds: number;
  dryRun: boolean;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
