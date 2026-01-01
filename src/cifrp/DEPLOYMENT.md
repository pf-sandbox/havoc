# CIFRP Deployment Guide

## Prerequisites

- Solana CLI v1.18+
- Anchor CLI v0.30.1+
- Node.js v18+
- Solana keypair with sufficient SOL

## Step 1: Build

```bash
cd src/cifrp/contracts
anchor build --release
```

## Step 2: Deploy

### Devnet
```bash
solana config set --url devnet
solana airdrop 5 <keypair>
anchor deploy --provider.cluster devnet
```

### Mainnet
```bash
solana config set --url mainnet-beta
anchor deploy --provider.cluster mainnet-beta
```

Record the Program ID.

## Step 3: Initialize Pool

```bash
npm run cifrp:init -- \
  --token-mint <TOKEN_MINT> \
  --epoch-length 21600 \
  --network devnet
```

## Step 4: Configure Fee Router

Register CIFRP vault with Pump.fun fee router to receive 30% of creator fees.

## Step 5: Register Havoc Oracle

Configure CIFRP to consume Havoc behavioral score snapshots.

## Step 6: Verify

```bash
npm run cifrp:health-check -- \
  --pool <POOL_ADDRESS> \
  --network devnet
```

## Monitoring

Watch for events:
```bash
npm run cifrp:watch-events -- \
  --program-id <PROGRAM_ID> \
  --network devnet
```

Events: PoolInitialized, FeeDeposited, EpochSnapshotRegistered, RewardClaimed, EpochFinalized

## Rollback

Pause pool immediately:
```bash
npm run cifrp:pause -- \
  --pool <POOL_ADDRESS> \
  --network devnet
```

## Security Checklist

- [ ] All constants verified
- [ ] Full test suite passing
- [ ] Security audit completed
- [ ] Admin key in hardware wallet
- [ ] Devnet testing successful
- [ ] Fee router integration tested
- [ ] Havoc oracle integration tested
- [ ] Monitoring alerts configured
