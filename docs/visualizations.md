# Havoc Visualizations

## 1. MM Action Response Matrix

Action taken based on creator band and market volatility:

```
                  LOW VOL    MED VOL    HIGH VOL    EXTREME
GUARDIAN          SPREAD_    MOMENTUM_  VOLUME_     CRASH_
                  COMPRESS   VALID      SMOOTHING   BUFFER

NEUTRAL           NO_ACTION  SPREAD_    VOLUME_     CRASH_
                             COMPRESS   SMOOTHING   BUFFER

ADVERSARIAL       NO_ACTION  FRICTION   FRICTION    FRICTION
                             FRICTION   FRICTION    FRICTION
```

**Legend**:
- SPREAD_COMPRESS: Tighten bid-ask spread
- MOMENTUM_VALID: Reduce friction on organic demand
- VOLUME_SMOOTHING: Counter unusual spikes
- CRASH_BUFFER: Deploy micro-LP on drops
- FRICTION: Add resistance to extractions
- NO_ACTION: Neutral stance

---

## 2. CRI Scoring Inputs (Contribution Radar)

Relative influence of each input on final CRI score:

```
                    Rug History
                         ▲
                        ╱│╲
                       ╱ │ ╲
                      ╱  │  ╲
         Launch      ╱   │   ╲  Bot Activity
         Stability  ╱    │    ╲
                   ╱     │     ╲
                  ╱      │      ╲
                 ╱       │       ╲
        Holder  ╱        │        ╲ Early-Exit
        Dist   ╱         │         ╲ Patterns
              ╱    ▲─────┼─────▼    ╲
             ╱    ╱       │       ╲   ╲
            ╱   ╱         │         ╲   ╲
           ╱  ╱           │           ╲  ╱
          ╱ ╱             │             ╲╱
         ╱                               
        LP Retention ← ─ → Graduation Rate
```

**Influence Levels** (relative weighting):
- Rug History: High
- Launch Stability: Medium-High
- Bot Activity: Medium
- Holder Distribution: Medium
- Early-Exit Patterns: Medium
- LP Retention: Medium
- Graduation Rate: High

---

## 3. Spread Compression Effect

**Before Intervention** (Wide Spread):

```
Price Ladder          Order Book
$0.00105 │ Ask (6 orders)
$0.00104 │
$0.00103 │
$0.00102 │
$0.00101 │              Gap: 0.00010 SOL
$0.00100 │              (100 bps spread)
$0.000999│
$0.000998│ Bid (8 orders)
$0.000997│
$0.000996│
```

**After SPREAD_COMPRESSION** (Tightened Spread):

```
Price Ladder          Order Book
$0.00105 │ Ask (9 orders)
$0.00104 │
$0.00103 │
$0.00102 │
$0.00101 │              Gap: 0.00001 SOL
$0.00100 │              (10 bps spread)
$0.000999│
$0.000998│ Bid (10 orders)
$0.000997│
$0.000996│
```

**Benefits**:
- Better execution price for traders
- Reduced slippage
- Tighter price discovery
- Increased volume confidence
