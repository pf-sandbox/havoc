/**
 * Havoc Mode Exports
 * 
 * Main entry point for Havoc system.
 * Public API: Orchestrator + Status reporting
 * Internal: CRI, MM, State Machine (black-boxed)
 */

export { HavocOrchestrator, type HavocConfig, type HavocStatus } from "./havoc-core";
export { default as CreatorReputationIndex, type CRIBand } from "./cri";
export { default as HavocMarketMaker, type PoolState, type MayhemSignal, type MMAction } from "./market-maker";
export { default as HavocStateMachine, type HavocState, type StateTransition } from "./state-machine";
export { default as MayhemSignalProvider, type MayhemSignalData, type ChaosMetrics } from "./mayhem-signal-provider";
export { default as LiquidityManager, type LiquidityOrder, type LiquidityBudget } from "./liquidity-manager";
export { default as PoolIntegration, type HavocPoolState } from "./pool-integration";
export { default as PerformanceDashboard, type PerformanceMetrics, type DashboardSnapshot } from "./performance-dashboard";
export { default as PatternDetector, type AnomalyScore, type PatternSignature, type TransitionProbability } from "./pattern-detector";
export { HavocEventEmitter, getHavocEventEmitter, resetEventEmitter, type HavocEventType, type CRIChangeEvent, type StateTransitionEvent, type ActionExecutedEvent, type RugDetectedEvent, type AnomalyDetectedEvent, type BudgetAlertEvent } from "./event-emitter";
