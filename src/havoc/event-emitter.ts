/**
 * Havoc Event System
 * 
 * Typed event emitter for all Havoc operations.
 * Replaces logging with proper pub-sub for dashboards, APIs, and external integrations.
 * 
 * Events:
 * - CRI band changes
 * - State transitions
 * - MM actions executed
 * - Rug detection
 * - Anomalies detected
 * - Budget alerts
 */

import { PublicKey } from "@solana/web3.js";
import { EventEmitter } from "events";
import { CRIBand } from "./cri";
import { HavocState } from "./state-machine";
import { MMAction } from "./market-maker";
import { logger } from "../utils/logger";

/**
 * All event types in Havoc system.
 */
export type HavocEventType =
  | "CRI_CHANGE"
  | "STATE_TRANSITION"
  | "ACTION_EXECUTED"
  | "RUG_DETECTED"
  | "ANOMALY_DETECTED"
  | "BUDGET_ALERT"
  | "INITIALIZATION_COMPLETE"
  | "TERMINATION"
  | "ERROR";

/**
 * Event payloads for each type.
 */

export interface CRIChangeEvent {
  mint: PublicKey;
  previousBand: CRIBand | null;
  newBand: CRIBand;
  timestamp: number;
  score?: number; // For testing only
}

export interface StateTransitionEvent {
  mint: PublicKey;
  fromState: HavocState;
  toState: HavocState;
  triggeredBy: string;
  timestamp: number;
  blockNumber?: number;
}

export interface ActionExecutedEvent {
  mint: PublicKey;
  actionType: string;
  timestamp: number;
  signature?: string;
  confidence?: number;
  context?: Record<string, unknown>;
}

export interface RugDetectedEvent {
  mint: PublicKey;
  severity: number; // 0-1
  detectionMethod: string; // e.g., "LP_DRAIN", "HOLDER_COLLAPSE"
  timestamp: number;
  details?: Record<string, unknown>;
}

export interface AnomalyDetectedEvent {
  mint: PublicKey;
  anomalyType: string; // e.g., "VOLUME_SPIKE", "SPREAD_WIDENING"
  severity: number; // 0-1
  confidence: number; // 0-1
  timestamp: number;
  recommendedAction?: string;
}

export interface BudgetAlertEvent {
  mint: PublicKey;
  alertType: "HOURLY_LIMIT_REACHED" | "BLOCK_CAP_EXCEEDED" | "LOW_REMAINING";
  used: number;
  limit: number;
  remaining: number;
  timestamp: number;
}

export interface InitializationCompleteEvent {
  mint: PublicKey;
  initialBand: CRIBand | null;
  initialState: HavocState;
  timestamp: number;
}

export interface TerminationEvent {
  mint: PublicKey;
  reason: string;
  finalState: HavocState;
  timestamp: number;
}

export interface ErrorEvent {
  mint?: PublicKey;
  error: string;
  context?: string;
  timestamp: number;
}

/**
 * Union of all event payloads.
 */
export type HavocEventPayload =
  | CRIChangeEvent
  | StateTransitionEvent
  | ActionExecutedEvent
  | RugDetectedEvent
  | AnomalyDetectedEvent
  | BudgetAlertEvent
  | InitializationCompleteEvent
  | TerminationEvent
  | ErrorEvent;

/**
 * Typed event listener function.
 */
export type HavocEventListener<T extends HavocEventType> = (
  payload: Extract<HavocEventPayload, { [K in T]: any }>
) => void;

/**
 * Central event emitter for Havoc.
 */
export class HavocEventEmitter {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Emit a CRI change event.
   */
  emitCRIChange(event: CRIChangeEvent): void {
    this.emitter.emit("CRI_CHANGE", event);
    logger.info(
      `CRI update for ${event.mint.toBase58().slice(0, 8)}: ${event.previousBand ?? "null"} → ${event.newBand}`
    );
  }

  /**
   * Emit a state transition event.
   */
  emitStateTransition(event: StateTransitionEvent): void {
    this.emitter.emit("STATE_TRANSITION", event);
    logger.info(
      `State transition: ${event.fromState} → ${event.toState} (triggered by ${event.triggeredBy})`
    );
  }

  /**
   * Emit an action executed event.
   */
  emitActionExecuted(event: ActionExecutedEvent): void {
    this.emitter.emit("ACTION_EXECUTED", event);
    logger.info(`MM action [${event.actionType}] for ${event.mint.toBase58().slice(0, 8)}`);
  }

  /**
   * Emit a rug detection event.
   */
  emitRugDetected(event: RugDetectedEvent): void {
    this.emitter.emit("RUG_DETECTED", event);
    logger.warn(
      `Rug detected for ${event.mint.toBase58().slice(0, 8)}: severity=${event.severity.toFixed(2)}`
    );
  }

  /**
   * Emit an anomaly detected event.
   */
  emitAnomalyDetected(event: AnomalyDetectedEvent): void {
    this.emitter.emit("ANOMALY_DETECTED", event);
    logger.info(
      `Anomaly detected [${event.anomalyType}] for ${event.mint.toBase58().slice(0, 8)}: severity=${event.severity.toFixed(2)}`
    );
  }

  /**
   * Emit a budget alert event.
   */
  emitBudgetAlert(event: BudgetAlertEvent): void {
    this.emitter.emit("BUDGET_ALERT", event);
    logger.warn(
      `Budget alert [${event.alertType}] for ${event.mint.toBase58().slice(0, 8)}: ${event.used}/${event.limit}`
    );
  }

  /**
   * Emit an initialization complete event.
   */
  emitInitializationComplete(event: InitializationCompleteEvent): void {
    this.emitter.emit("INITIALIZATION_COMPLETE", event);
    logger.info(`Havoc initialized for ${event.mint.toBase58().slice(0, 8)}`);
  }

  /**
   * Emit a termination event.
   */
  emitTermination(event: TerminationEvent): void {
    this.emitter.emit("TERMINATION", event);
    logger.info(`Havoc terminated: ${event.reason}`);
  }

  /**
   * Emit an error event.
   */
  emitError(event: ErrorEvent): void {
    this.emitter.emit("ERROR", event);
    const prefix = event.mint ? ` [${event.mint.toBase58().slice(0, 8)}]` : "";
    logger.error(`Havoc error${prefix}: ${event.error}`);
  }

  /**
   * Subscribe to a specific event type.
   */
  on<T extends HavocEventType>(
    eventType: T,
    listener: HavocEventListener<T>
  ): () => void {
    this.emitter.on(eventType, listener as any);

    // Return unsubscribe function
    return () => {
      this.emitter.removeListener(eventType, listener as any);
    };
  }

  /**
   * Subscribe to event once.
   */
  once<T extends HavocEventType>(
    eventType: T,
    listener: HavocEventListener<T>
  ): () => void {
    this.emitter.once(eventType, listener as any);

    return () => {
      this.emitter.removeListener(eventType, listener as any);
    };
  }

  /**
   * Subscribe to all events (for logging/monitoring).
   */
  onAny(listener: (eventType: HavocEventType, payload: HavocEventPayload) => void): () => void {
    const wrappedListener = (payload: HavocEventPayload, eventType: HavocEventType) => {
      listener(eventType, payload);
    };

    // Listen to all event types
    const types: HavocEventType[] = [
      "CRI_CHANGE",
      "STATE_TRANSITION",
      "ACTION_EXECUTED",
      "RUG_DETECTED",
      "ANOMALY_DETECTED",
      "BUDGET_ALERT",
      "INITIALIZATION_COMPLETE",
      "TERMINATION",
      "ERROR",
    ];

    for (const type of types) {
      this.emitter.on(type, (payload) => wrappedListener(payload, type));
    }

    // Return unsubscribe function
    return () => {
      for (const type of types) {
        this.emitter.removeAllListeners(type);
      }
    };
  }

  /**
   * Get listener count for an event type.
   */
  listenerCount(eventType: HavocEventType): number {
    return this.emitter.listenerCount(eventType);
  }

  /**
   * Remove all listeners.
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

/**
 * Global singleton event emitter instance.
 */
let globalEventEmitter: HavocEventEmitter | null = null;

export function getHavocEventEmitter(): HavocEventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new HavocEventEmitter();
  }
  return globalEventEmitter;
}

export function resetEventEmitter(): void {
  if (globalEventEmitter) {
    globalEventEmitter.removeAllListeners();
  }
  globalEventEmitter = null;
}

export default HavocEventEmitter;
