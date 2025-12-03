# HAVOC - Reputation-Aware Market Maker

AI-driven market stabilization for pump.fun tokens. Havoc evaluates creator trustworthiness and provides intelligent liquidity support to legitimate projects while protecting users from extractive schemes.

**Mayhem** tests token resilience through market stress.
**Havoc** rewards trustworthy creators with liquidity support and identifies bad actors.

Together they create a healthier token ecosystem.

## Core Features

### 1. Creator Reputation Index (CRI)

Proprietary scoring system that evaluates creator trustworthiness based on on-chain behavior. Outputs as band classifications for transparent creator status.

**Evaluation Inputs**:
- Rug history and severity
- Graduation success rate
- Post-graduation liquidity health
- Holder distribution quality
- Early-exit patterns
- Bot activity detection
- Positive indicators (stable launches, consistent support)

**Creator Bands**:
- **Guardian** (≥80): Proven track record, receives active liquidity support
- **Neutral** (40–79): Standard market-making support
- **Adversarial** (<40): Enhanced monitoring and user protection

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

Intelligent liquidity management that responds to creator reputation and market conditions.

**Core Actions**:
- **Spread Compression**: Tightens bid-ask spreads for better trading execution
- **Volume Smoothing**: Stabilizes price during unusual volume spikes
- **Momentum Validation**: Reduces friction on organic, healthy demand
- **User Protection**: Adds safeguards against suspicious extraction patterns
- **Crash Buffering**: Deploys micro-liquidity to minimize cascading drops

**Smart Coordination**:
- Guardian creators: Maximum liquidity support and favorable spreads
- Adversarial creators: Enhanced monitoring with protective measures
- All actions logged transparently with timestamps and execution details

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

## Proprietary Models

**Sophisticated, Non-Disclosing Algorithms**:
- CRI scoring formulas are proprietary to maintain system integrity
- MM decision thresholds are adaptive and non-predictable
- State transition logic protects against gaming and manipulation

**This approach ensures**:
- Fair evaluation that cannot be gamed by bad actors
- Protection against MM front-running or exploitation
- Predictable, consistent behavior across different market conditions

**Full Transparency Where It Matters**:
- Creator band classifications (Guardian/Neutral/Adversarial)
- Complete action history with timestamps and details
- State transitions and their triggers
- Performance metrics (rug prevention rate, volatility reduction)

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

## Safety Features

- Sustainable intervention caps (per-block and hourly limits)
- Non-profit model ensures alignment with user interests
- 24-hour support cooldown promotes creator independence
- Transparent logging for full auditability

## Roadmap

- Havoc "Trust Badge" — public certification for high-CRI creators
- Holder Protection Pot — verified rug compensation mechanism
- Havoc Oracle — on-chain reputation feeds for aggregators and dApps
- Multi-chain reputation signals

## Requirements

- Requires `is_mayhem_mode = true` on pump.fun tokens
- Fully integrated with Mayhem Mode system
- Tested and validated across multiple market conditions
