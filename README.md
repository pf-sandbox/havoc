# Havoc AI Agent Bot

Ai Agent market-making system for pump.fun tokens that evaluates creator behavior and adjusts liquidity support accordingly.

**Mayhem** introduces volatility and tests token robustness.
**Havoc** evaluates creator reputation and provides liquidity support or adds friction based on trustworthiness.

Together they sort legitimate projects from bad ones.

## Core Features

### 1. Creator Reputation Index (CRI)

Scoring system that evaluates creator behavior on-chain. Produces band classifications (Guardian/Neutral/Adversarial).

**Inputs**:
- Rug history and severity
- Graduation rate
- LP retention post-grad
- Holder distribution
- Early-exit patterns
- Bot activity
- Launch stability

**Bands**:
- **Guardian** (≥80): Active liquidity support
- **Neutral** (40–79): Standard MM support
- **Adversarial** (<40): Friction applied, monitoring

### 2. State Machine

Deterministic transitions with opaque logic.

```
INIT → ACTIVE → GUARDIAN/NEUTRAL/ADVERSARIAL → COOLDOWN → TERMINATED
```

**Transitions**:
- CRI change triggers state update
- Rug detection → ADVERSARIAL
- 24h elapsed → COOLDOWN (taper MM activity)
- Manual termination → TERMINATED

### 3. Market-Making Engine

Responds to pool state and creator band with liquidity adjustments.

**Actions**:
- **Spread Compression**: Tighten spreads
- **Volume Smoothing**: Counter unusual spikes
- **Momentum Validation**: Reduce friction on organic demand
- **Extraction Suppression**: Add friction to suspicious exits
- **Crash Buffering**: Deploy micro-LP on drops

**Response**:
- Guardian: Max support
- Adversarial: Friction + monitoring
- All actions logged (type, timestamp)

## Architecture

```
src/
├── havoc/                          # Havoc core modules
│   ├── cri.ts                      # Creator Reputation Index (opaque)
│   ├── market-maker.ts             # MM engine (black-boxed decisions)
│   ├── state-machine.ts            # State transitions (hidden logic)
│   ├── havoc-core.ts               # Main orchestrator
│   └── index.ts                    # Public API
├── __tests__/
│   └── havoc-mayhem-coordination.test.ts  # Dual-agent tests
├── pool.ts                         # Pool state utilities
├── mayhem-detector.ts              # Mayhem Mode detection
└── config.ts                       # Configuration
```

## Integration

### Initialize

```typescript
const havoc = new HavocOrchestrator(connection, {
  tokenMint,
  launchTime: Date.now(),
  maxInterventionsPerHour: 10,
  cooldownDurationMs: 86400000,
  updateFrequencyMs: 5000,
});

await havoc.initialize();
```

### Main Loop

```typescript
// Call on each block or at updateFrequencyMs interval:
const mayhemSignal = { chaosLevel: 0.8, suggestedSynchronization: true };
const action = await havoc.tick(mayhemSignal);
// action.type: SPREAD_COMPRESSION | VOLUME_SMOOTHING | EXTRACTION_SUPPRESSION | ...
```

### Rug Detection Hook

```typescript
if (rugDetected) {
  await havoc.onRugDetected(severity); // 0-1
  // Automatically transitions to ADVERSARIAL
}
```

### Status & Logs

```typescript
const status = havoc.getStatus();
// { state, criband, totalActions, nextActionEligible, lastUpdate }

const actionLog = havoc.getActionLog(100);
// [{ type, timestamp, signature? }, ...]
```

## Algorithm Opacity

**Non-Public**:
- CRI scoring internals
- MM decision logic
- State transition rules
- Confidence scores

**Public**:
- Band classifications (Guardian/Neutral/Adversarial)
- Action history (type, timestamp)
- State transitions
- Metrics (rug rate, volatility delta)

## Testing

Test Havoc ↔ Mayhem coordination:

```bash
npm test -- havoc-mayhem-coordination
```

**Coverage**:
- CRI band transitions under Mayhem interference
- State machine on rug detection
- MM response to Mayhem signals
- Guardian dampening vs Adversarial sync
- Action logging + rate limiting
- Internal test-only methods

## Configuration

Via environment variables:

```
TOKEN_MINT=<mint>
DISTRIBUTE_WALLET_NUM=5
INITIAL_SOL_PER_WALLET=0.5
DURATION_SECONDS=86400
DRY_RUN=false
USE_JITO=true
USE_NOZOMI=true
USE_0SLOT=true
USE_BLOCKRAZOR=true
USE_BLOXROUTE=true
```

## Safeguards

- Intervention caps (per-block, hourly)
- Non-profit operation
- 24h cooldown post-support
- Action logging

## Future

- Havoc "Trust Badge" for high-CRI creators
- Holder Protection Pot (verified rug compensation)
- On-chain reputation oracle
- Multi-chain signals

## Requirements

- `is_mayhem_mode = true`
- Integrated with Mayhem Mode
- Tested across market conditions
