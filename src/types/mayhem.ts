import { PublicKey } from "@solana/web3.js";

export const MAYHEM_PROGRAM_ID = new PublicKey("MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e");
export const MAYHEM_FEE_RECIPIENT = new PublicKey("GesfTA3X2arioaHp8bbKdjG9vJtskViWACZoYvxp4twS");
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const LEGACY_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export interface MayhemStatus {
  isMayhemMode: boolean;
  tokenProgram: "Legacy" | "Token2022";
  feeRecipient: PublicKey;
}
