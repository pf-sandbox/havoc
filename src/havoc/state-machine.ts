/**
 * Havoc State Machine
 * 
 * Transitions: INIT → ACTIVE → GUARDIAN/NEUTRAL/ADVERSARIAL → COOLDOWN → TERMINATED
 * 
 * Internal state logic is opaque.
 * Only state bands and transition logs are visible externally.
 */

import { PublicKey } from "@solana/web3.js";
import { CRIBand } from "./cri";
import { logger } from "../utils/logger";

export type HavocState = "INIT" | "ACTIVE" | "GUARDIAN" | "NEUTRAL" | "ADVERSARIAL" | "COOLDOWN" | "TERMINATED";

export interface StateTransition {
  from: HavocState;
  to: HavocState;
  timestamp: number;
  triggeredBy: string; // High-level trigger (e.g., "CRI_CHANGE", "RUG_DETECTED", "24H_COOLDOWN")
  blockNumber?: number;
}

interface TokenState {
  mint: PublicKey;
  currentState: HavocState;
  criband: CRIBand | null;
  stateStartTime: number;
  transitionHistory: StateTransition[];
  launchTime: number;
}

/**
 * Internal state machine logic (black box).
 * Deterministic but not exposed.
 */
class HavocStateMachine {
  private tokenStates: Map<string, TokenState> = new Map();
  private stateEntryHandlers: Map<HavocState, () => Promise<void>> = new Map();
  private stateExitHandlers: Map<HavocState, () => Promise<void>> = new Map();

  constructor() {
    this.registerHandlers();
  }

  /**
   * Register internal state handlers (hidden logic).
   */
  private registerHandlers(): void {
    // INIT handlers
    this.stateEntryHandlers.set("INIT", async () => {
      logger.info("Entering INIT state: evaluating token and CRI");
    });

    this.stateExitHandlers.set("INIT", async () => {
      logger.info("Exiting INIT: token ready for active monitoring");
    });

    // ACTIVE handlers
    this.stateEntryHandlers.set("ACTIVE", async () => {
      logger.info("Entering ACTIVE state: MM engine online");
    });

    // COOLDOWN handlers
    this.stateEntryHandlers.set("COOLDOWN", async () => {
      logger.info("Entering COOLDOWN: tapering interventions over 24h");
    });

    // TERMINATED handlers
    this.stateEntryHandlers.set("TERMINATED", async () => {
      logger.info("Havoc disengaged for this token");
    });
  }

  /**
   * Initialize monitoring for a token.
   */
  async initializeToken(mint: PublicKey, launchTime: number): Promise<HavocState> {
    const mintKey = mint.toBase58();

    const state: TokenState = {
      mint,
      currentState: "INIT",
      criband: null,
      stateStartTime: Date.now(),
      transitionHistory: [],
      launchTime,
    };

    this.tokenStates.set(mintKey, state);
    return "INIT";
  }

  /**
   * Transition based on CRI band change.
   * Internal logic maps band to state (black box).
   */
  async transitionOnCRIChange(mint: PublicKey, newBand: CRIBand): Promise<HavocState> {
    const mintKey = mint.toBase58();
    const state = this.tokenStates.get(mintKey);

    if (!state) {
      throw new Error(`Token ${mintKey} not initialized`);
    }

    const prevBand = state.criband;
    state.criband = newBand;

    // Internal transition logic (not exposed)
    const newState = this.bandToActiveState(newBand);

    if (newState !== state.currentState) {
      await this.performTransition(state, newState, "CRI_CHANGE");
    }

    return state.currentState;
  }

  /**
   * Map CRI band to active state (internal).
   */
  private bandToActiveState(band: CRIBand): HavocState {
    switch (band) {
      case "GUARDIAN":
        return "GUARDIAN";
      case "NEUTRAL":
        return "NEUTRAL";
      case "ADVERSARIAL":
        return "ADVERSARIAL";
      default:
        return "ACTIVE";
    }
  }

  /**
   * Trigger rug detection response.
   * Internal decision: how to respond (black box).
   */
  async onRugDetected(mint: PublicKey, severity: number): Promise<HavocState> {
    const mintKey = mint.toBase58();
    const state = this.tokenStates.get(mintKey);

    if (!state) {
      throw new Error(`Token ${mintKey} not initialized`);
    }

    logger.warn(`Rug detected for ${mintKey.slice(0, 8)}: severity=${severity.toFixed(2)}`);

    // Internal logic: severity determines response
    if (state.currentState !== "ADVERSARIAL") {
      await this.performTransition(state, "ADVERSARIAL", "RUG_DETECTED");
    }

    return state.currentState;
  }

  /**
   * Enter cooldown phase after 24h of active support.
   * Internal taper logic (hidden).
   */
  async enterCooldown(mint: PublicKey): Promise<HavocState> {
    const mintKey = mint.toBase58();
    const state = this.tokenStates.get(mintKey);

    if (!state) {
      throw new Error(`Token ${mintKey} not initialized`);
    }

    const elapsedMs = Date.now() - state.launchTime;
    const elapsed24h = elapsedMs > 24 * 60 * 60 * 1000;

    if (elapsed24h && state.currentState !== "COOLDOWN") {
      await this.performTransition(state, "COOLDOWN", "24H_THRESHOLD");
    }

    return state.currentState;
  }

  /**
   * Terminate Havoc intervention.
   */
  async terminate(mint: PublicKey, reason: string): Promise<void> {
    const mintKey = mint.toBase58();
    const state = this.tokenStates.get(mintKey);

    if (!state) {
      throw new Error(`Token ${mintKey} not initialized`);
    }

    await this.performTransition(state, "TERMINATED", reason);
  }

  /**
   * Perform state transition with handlers.
   */
  private async performTransition(
    state: TokenState,
    newState: HavocState,
    trigger: string
  ): Promise<void> {
    const prevState = state.currentState;

    // Run exit handler
    const exitHandler = this.stateExitHandlers.get(prevState);
    if (exitHandler) {
      await exitHandler();
    }

    // Update state
    state.currentState = newState;
    state.stateStartTime = Date.now();

    // Record transition
    const transition: StateTransition = {
      from: prevState,
      to: newState,
      timestamp: Date.now(),
      triggeredBy: trigger,
    };
    state.transitionHistory.push(transition);

    // Run entry handler
    const entryHandler = this.stateEntryHandlers.get(newState);
    if (entryHandler) {
      await entryHandler();
    }

    logger.info(`State transition: ${prevState} → ${newState} (triggered by ${trigger})`);
  }

  /**
   * Get current state (opaque externally, band + state only).
   */
  getState(mint: PublicKey): HavocState | null {
    const state = this.tokenStates.get(mint.toBase58());
    return state?.currentState ?? null;
  }

  /**
   * Get transition history (for transparency and testing).
   */
  getTransitionHistory(mint: PublicKey, limit: number = 50): StateTransition[] {
    const state = this.tokenStates.get(mint.toBase58());
    return state?.transitionHistory.slice(-limit) ?? [];
  }

  /**
   * Check if in cooldown phase.
   */
  isInCooldown(mint: PublicKey): boolean {
    const state = this.tokenStates.get(mint.toBase58());
    return state?.currentState === "COOLDOWN" ?? false;
  }

  /**
   * Get time elapsed in current state (for cooldown taper).
   */
  getStateElapsedMs(mint: PublicKey): number {
    const state = this.tokenStates.get(mint.toBase58());
    if (!state) return 0;
    return Date.now() - state.stateStartTime;
  }

  /**
   * For testing: expose internal state (testing only).
   */
  getInternalStateForTesting(mint: PublicKey): TokenState | null {
    return this.tokenStates.get(mint.toBase58()) ?? null;
  }
}

export default HavocStateMachine;
