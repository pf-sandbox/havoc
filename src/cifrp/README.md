# CIFRP - Community-Incentivized Fee Redistribution Pool

Non-custodial reward distribution system that redirects 30% of Pump.fun creator fees to eligible token holders based on behavioral scores from Havoc oracle.

## Key Features

- **Fee Split**: 30% CIFRP, 50% Creator, 20% Reserved (immutable post-launch)
- **Epochs**: 6-hour distribution windows with skip logic for low balances (<0.5 SOL)
- **Claims**: Pull-based, user-initiated with Merkle proof verification
- **Verification**: Havoc behavioral scores determine eligibility and weights
- **Security**: No unchecked arithmetic, all SOL in PDAs, one claim per user per epoch

## Architecture

```
TypeScript Utilities (Off-Chain)
├── types.ts              - Type definitions
├── merkle.ts             - Merkle tree implementation
├── fee-router.ts         - Fee allocation logic
├── reward-calculator.ts  - Reward calculation engine
├── epoch-manager.ts      - Epoch state management
└── claim-handler.ts      - Claim validation

Anchor Contracts (On-Chain)
├── lib.rs                - Program entry point
├── state.rs              - Account structures
├── constants.rs          - On-chain constants
├── errors.rs             - Error definitions
├── events.rs             - Event structures
└── instructions/         - 7 instruction handlers
```

## Core Concepts

### Fee Routing
```
Creator Fee → 30% CIFRP Pool | 50% Creator | 20% Reserved
```
Immutable split enforced at initialization.

### Reward Formula
```
user_reward = (epoch_pool_balance * user_weight) / havoc_total_weight
```
Uses floor rounding with dust tracking.

### Epochs
- Duration: 6 hours
- ID: `floor(timestamp / 21600)`
- Minimum pool: 0.5 SOL (skip if below)
- Dust rollover to next epoch

### Eligibility
Determined by Havoc oracle snapshots. CIFRP enforces but does not compute.

## Usage

```typescript
import { allocateFee, EpochManager, MerkleTree, ClaimHandler } from '@havoc/cifrp';

// Fee allocation
const allocation = allocateFee(BigInt(1_000_000));
// { cifrpPoolAmount: 300000n, creatorAmount: 500000n, reservedAmount: 200000n }

// Epoch initialization
const epochMgr = new EpochManager();
epochMgr.initializeEpoch(epochId, poolBalance, merkleRoot, totalWeight);

// User claim validation
const claimMgr = new ClaimHandler();
const valid = claimMgr.validateClaim({ epochId, wallet, userLeaf, merkleProof, merkleRoot, rewardAmount });

if (valid.valid) {
  claimMgr.recordClaim(epochId, wallet, rewardAmount);
}
```

## Error Codes

- `PoolPaused`: Distribution halted
- `UserIneligible`: Not eligible for rewards
- `InvalidMerkleProof`: Proof verification failed
- `AlreadyClaimed`: Already claimed for this epoch
- `ZeroReward`: Computed reward is zero
- `InsufficientBalance`: Pool balance insufficient
- `EpochNotFinalized`: Epoch not ready for claims

## Security Guarantees

- ✅ No manual fund extraction (PDA-only)
- ✅ Rewards proportional to behavior (Havoc-determined)
- ✅ One claim per user per epoch (enforced)
- ✅ No creator access to CIFRP funds (separate vault)
- ✅ Immutable oracle data (snapshot-based)

## Testing

Run tests:
```bash
npm test -- src/cifrp/__tests__/
```

Coverage: 130+ tests across all modules

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions.

## Constants

| Name | Value | Purpose |
|------|-------|---------|
| EPOCH_LENGTH | 6 hours | Distribution window |
| MIN_POOL | 0.5 SOL | Skip threshold |
| FEE_SPLIT_CIFRP | 30% | CIFRP allocation |
| FEE_SPLIT_CREATOR | 50% | Creator allocation |
| FEE_SPLIT_RESERVED | 20% | Reserved allocation |
| MAX_MERKLE_DEPTH | 32 | Proof depth limit |

## Integration Checklist

- [ ] Deploy Anchor programs
- [ ] Initialize CIFRP pool with token mint
- [ ] Configure Pump.fun fee router
- [ ] Register Havoc oracle endpoint
- [ ] Enable distributions and monitoring
