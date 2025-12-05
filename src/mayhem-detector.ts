import { PublicKey, Connection } from "@solana/web3.js";
import { BorshCoder } from "@coral-xyz/anchor";
import { IDL } from "./IDL/index";
import { MAYHEM_FEE_RECIPIENT, MAYHEM_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, MayhemStatus } from "./types/mayhem";
import { logger } from "./utils/logger";

const PUMP_AMM_PROGRAM_ID = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

/**
 * Detect if a token is using Mayhem Mode and Token2022
 */
export async function detectMayhemMode(
  connection: Connection,
  tokenMint: PublicKey,
  poolAddress: PublicKey
): Promise<MayhemStatus> {
  try {
    // Fetch the bonding curve account
    const accountInfo = await connection.getAccountInfo(poolAddress);
    if (!accountInfo) {
      logger.warn(`Pool ${poolAddress.toBase58()} not found`);
      return {
        isMayhemMode: false,
        tokenProgram: "Legacy",
        feeRecipient: new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"), // Default pump.fun fee recipient
      };
    }

    // Decode the bonding curve account
    const coder = new BorshCoder(IDL);
    const decoded = coder.accounts.decode("pool", accountInfo.data);

    // Check for isMayhemMode field (added in Nov 2025 breaking changes)
    const isMayhemMode = (decoded as any).isMayhemMode || false;

    // Determine fee recipient based on mayhem mode
    const feeRecipient = isMayhemMode
      ? MAYHEM_FEE_RECIPIENT
      : new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"); // Standard pump.fun fee recipient

    // Determine token program (would need to check mint on-chain for definitive answer)
    // For now, assume Token2022 if Mayhem Mode, Legacy otherwise
    const tokenProgram = isMayhemMode ? "Token2022" : "Legacy";

    logger.info(`Token ${tokenMint.toBase58()}: Mayhem=${isMayhemMode}, Program=${tokenProgram}`);

    return {
      isMayhemMode,
      tokenProgram,
      feeRecipient,
    };
  } catch (error) {
    logger.error(`Failed to detect Mayhem Mode for ${tokenMint.toBase58()}: ${error}`);
    // Return conservative defaults
    return {
      isMayhemMode: false,
      tokenProgram: "Legacy",
      feeRecipient: new PublicKey("62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV"),
    };
  }
}

/**
 * Get Mayhem-related PDAs
 */
export function getMayhemStatePda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-state"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID
  );
}

export function getGlobalParamsPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global-params")],
    MAYHEM_PROGRAM_ID
  );
}

export function getSolVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sol-vault")],
    MAYHEM_PROGRAM_ID
  );
}

export function getMayhemTokenVaultPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mayhem-token-vault"), mint.toBuffer()],
    MAYHEM_PROGRAM_ID
  );
}
