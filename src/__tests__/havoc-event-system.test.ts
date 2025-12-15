/**
 * Havoc Event System Tests
 * 
 * Validates typed event emitter with proper pub-sub behavior.
 * Tests:
 * - Event emission and reception
 * - Type safety
 * - Subscription management
 * - Cross-system integration
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { PublicKey } from "@solana/web3.js";
import {
  HavocEventEmitter,
  getHavocEventEmitter,
  resetEventEmitter,
  type CRIChangeEvent,
  type StateTransitionEvent,
  type ActionExecutedEvent,
} from "../havoc/event-emitter";

describe("Havoc Event System", () => {
  let emitter: HavocEventEmitter;
  const testMint = new PublicKey("EventTestMintxxxxxxxxxxxxxxxxxxx");

  beforeEach(() => {
    resetEventEmitter();
    emitter = getHavocEventEmitter();
  });

  afterEach(() => {
    resetEventEmitter();
  });

  describe("Singleton Pattern", () => {
    it("should return same instance on repeated calls", () => {
      const emitter1 = getHavocEventEmitter();
      const emitter2 = getHavocEventEmitter();
      expect(emitter1).toBe(emitter2);
    });

    it("should reset to new instance after reset", () => {
      const emitter1 = getHavocEventEmitter();
      resetEventEmitter();
      const emitter2 = getHavocEventEmitter();
      expect(emitter1).not.toBe(emitter2);
    });
  });

  describe("CRI Change Events", () => {
    it("should emit CRI_CHANGE event with correct payload", (done) => {
      const event: CRIChangeEvent = {
        mint: testMint,
        previousBand: null,
        newBand: "GUARDIAN",
        timestamp: Date.now(),
      };

      emitter.on("CRI_CHANGE", (payload) => {
        expect(payload.mint.toBase58()).toBe(testMint.toBase58());
        expect(payload.newBand).toBe("GUARDIAN");
        expect(payload.previousBand).toBeNull();
        done();
      });

      emitter.emitCRIChange(event);
    });

    it("should handle band transition events", (done) => {
      const event: CRIChangeEvent = {
        mint: testMint,
        previousBand: "NEUTRAL",
        newBand: "ADVERSARIAL",
        timestamp: Date.now(),
      };

      emitter.on("CRI_CHANGE", (payload) => {
        expect(payload.previousBand).toBe("NEUTRAL");
        expect(payload.newBand).toBe("ADVERSARIAL");
        done();
      });

      emitter.emitCRIChange(event);
    });
  });

  describe("State Transition Events", () => {
    it("should emit STATE_TRANSITION event", (done) => {
      const event: StateTransitionEvent = {
        mint: testMint,
        fromState: "INIT",
        toState: "ACTIVE",
        triggeredBy: "INITIALIZATION",
        timestamp: Date.now(),
      };

      emitter.on("STATE_TRANSITION", (payload) => {
        expect(payload.fromState).toBe("INIT");
        expect(payload.toState).toBe("ACTIVE");
        done();
      });

      emitter.emitStateTransition(event);
    });

    it("should track multiple state transitions", (done) => {
      let count = 0;

      emitter.on("STATE_TRANSITION", () => {
        count++;
        if (count === 3) {
          expect(count).toBe(3);
          done();
        }
      });

      const states = ["INIT", "ACTIVE", "GUARDIAN", "COOLDOWN"];
      for (let i = 0; i < states.length - 1; i++) {
        emitter.emitStateTransition({
          mint: testMint,
          fromState: states[i] as any,
          toState: states[i + 1] as any,
          triggeredBy: "TEST",
          timestamp: Date.now(),
        });
      }
    });
  });

  describe("Action Executed Events", () => {
    it("should emit ACTION_EXECUTED event with confidence", (done) => {
      const event: ActionExecutedEvent = {
        mint: testMint,
        actionType: "SPREAD_COMPRESSION",
        timestamp: Date.now(),
        confidence: 0.87,
      };

      emitter.on("ACTION_EXECUTED", (payload) => {
        expect(payload.actionType).toBe("SPREAD_COMPRESSION");
        expect(payload.confidence).toBe(0.87);
        done();
      });

      emitter.emitActionExecuted(event);
    });

    it("should include transaction signature when available", (done) => {
      const event: ActionExecutedEvent = {
        mint: testMint,
        actionType: "VOLUME_SMOOTHING",
        timestamp: Date.now(),
        signature: "5xDW3Sv5LqpPaG9jZzT8Z9q1qB5qZ8Z8Z8Z8Z8Z8Z8",
      };

      emitter.on("ACTION_EXECUTED", (payload) => {
        expect(payload.signature).toBeDefined();
        done();
      });

      emitter.emitActionExecuted(event);
    });
  });

  describe("Rug Detection Events", () => {
    it("should emit RUG_DETECTED event", (done) => {
      emitter.on("RUG_DETECTED", (payload) => {
        expect(payload.severity).toBeCloseTo(0.8, 1);
        expect(payload.detectionMethod).toBe("LP_DRAIN");
        done();
      });

      emitter.emitRugDetected({
        mint: testMint,
        severity: 0.8,
        detectionMethod: "LP_DRAIN",
        timestamp: Date.now(),
      });
    });

    it("should include detection details", (done) => {
      emitter.on("RUG_DETECTED", (payload) => {
        expect(payload.details).toBeDefined();
        expect(payload.details?.lpRemoved).toBe(95);
        done();
      });

      emitter.emitRugDetected({
        mint: testMint,
        severity: 0.95,
        detectionMethod: "HOLDER_COLLAPSE",
        timestamp: Date.now(),
        details: { lpRemoved: 95, holdersAffected: 1200 },
      });
    });
  });

  describe("Anomaly Detection Events", () => {
    it("should emit ANOMALY_DETECTED event", (done) => {
      emitter.on("ANOMALY_DETECTED", (payload) => {
        expect(payload.anomalyType).toBe("VOLUME_SPIKE");
        expect(payload.severity).toBe(0.75);
        expect(payload.confidence).toBe(0.92);
        done();
      });

      emitter.emitAnomalyDetected({
        mint: testMint,
        anomalyType: "VOLUME_SPIKE",
        severity: 0.75,
        confidence: 0.92,
        timestamp: Date.now(),
      });
    });

    it("should include recommended action", (done) => {
      emitter.on("ANOMALY_DETECTED", (payload) => {
        expect(payload.recommendedAction).toBe("SPREAD_COMPRESSION");
        done();
      });

      emitter.emitAnomalyDetected({
        mint: testMint,
        anomalyType: "SPREAD_WIDENING",
        severity: 0.68,
        confidence: 0.88,
        timestamp: Date.now(),
        recommendedAction: "SPREAD_COMPRESSION",
      });
    });
  });

  describe("Budget Alert Events", () => {
    it("should emit BUDGET_ALERT for hourly limit", (done) => {
      emitter.on("BUDGET_ALERT", (payload) => {
        expect(payload.alertType).toBe("HOURLY_LIMIT_REACHED");
        expect(payload.used).toBe(10);
        expect(payload.limit).toBe(10);
        done();
      });

      emitter.emitBudgetAlert({
        mint: testMint,
        alertType: "HOURLY_LIMIT_REACHED",
        used: 10,
        limit: 10,
        remaining: 0,
        timestamp: Date.now(),
      });
    });

    it("should emit alert for low remaining budget", (done) => {
      emitter.on("BUDGET_ALERT", (payload) => {
        expect(payload.alertType).toBe("LOW_REMAINING");
        expect(payload.remaining).toBeLessThan(2);
        done();
      });

      emitter.emitBudgetAlert({
        mint: testMint,
        alertType: "LOW_REMAINING",
        used: 8.5,
        limit: 10,
        remaining: 1.5,
        timestamp: Date.now(),
      });
    });
  });

  describe("Subscription Management", () => {
    it("should return unsubscribe function", (done) => {
      const unsubscribe = emitter.on("CRI_CHANGE", () => {
        throw new Error("Should not be called");
      });

      // Unsubscribe
      unsubscribe();

      // Emit event (listener should not fire)
      emitter.emitCRIChange({
        mint: testMint,
        previousBand: null,
        newBand: "GUARDIAN",
        timestamp: Date.now(),
      });

      // Give it a moment, then pass if no error was thrown
      setTimeout(() => {
        done();
      }, 50);
    });

    it("should support multiple listeners on same event", (done) => {
      let count = 0;

      emitter.on("ACTION_EXECUTED", () => {
        count++;
      });

      emitter.on("ACTION_EXECUTED", () => {
        count++;
      });

      emitter.emitActionExecuted({
        mint: testMint,
        actionType: "CRASH_BUFFERING",
        timestamp: Date.now(),
      });

      setTimeout(() => {
        expect(count).toBe(2);
        done();
      }, 50);
    });

    it("should support once subscriptions", (done) => {
      let count = 0;

      emitter.once("STATE_TRANSITION", () => {
        count++;
      });

      emitter.emitStateTransition({
        mint: testMint,
        fromState: "INIT",
        toState: "ACTIVE",
        triggeredBy: "TEST",
        timestamp: Date.now(),
      });

      emitter.emitStateTransition({
        mint: testMint,
        fromState: "ACTIVE",
        toState: "GUARDIAN",
        triggeredBy: "TEST",
        timestamp: Date.now(),
      });

      setTimeout(() => {
        expect(count).toBe(1); // Only first call
        done();
      }, 50);
    });
  });

  describe("Event Listener Count", () => {
    it("should track listener count", () => {
      expect(emitter.listenerCount("CRI_CHANGE")).toBe(0);

      emitter.on("CRI_CHANGE", () => {});
      expect(emitter.listenerCount("CRI_CHANGE")).toBe(1);

      emitter.on("CRI_CHANGE", () => {});
      expect(emitter.listenerCount("CRI_CHANGE")).toBe(2);
    });
  });

  describe("Error Events", () => {
    it("should emit ERROR events", (done) => {
      emitter.on("ERROR", (payload) => {
        expect(payload.error).toBe("Initialization failed");
        expect(payload.context).toBe("Pool state fetch timeout");
        done();
      });

      emitter.emitError({
        mint: testMint,
        error: "Initialization failed",
        context: "Pool state fetch timeout",
        timestamp: Date.now(),
      });
    });
  });

  describe("Event Integration Scenarios", () => {
    it("should handle full token lifecycle with events", (done) => {
      const events: string[] = [];

      emitter.on("INITIALIZATION_COMPLETE", () => {
        events.push("INIT");
      });

      emitter.on("CRI_CHANGE", () => {
        events.push("CRI");
      });

      emitter.on("STATE_TRANSITION", () => {
        events.push("STATE");
      });

      emitter.on("ACTION_EXECUTED", () => {
        events.push("ACTION");
      });

      // Simulate lifecycle
      emitter.emitInitializationComplete({
        mint: testMint,
        initialBand: null,
        initialState: "INIT",
        timestamp: Date.now(),
      });

      emitter.emitCRIChange({
        mint: testMint,
        previousBand: null,
        newBand: "GUARDIAN",
        timestamp: Date.now(),
      });

      emitter.emitStateTransition({
        mint: testMint,
        fromState: "INIT",
        toState: "GUARDIAN",
        triggeredBy: "CRI_CHANGE",
        timestamp: Date.now(),
      });

      emitter.emitActionExecuted({
        mint: testMint,
        actionType: "SPREAD_COMPRESSION",
        timestamp: Date.now(),
      });

      setTimeout(() => {
        expect(events).toEqual(["INIT", "CRI", "STATE", "ACTION"]);
        done();
      }, 50);
    });
  });
});
