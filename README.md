# HAVOC - Mayhem Mode v2

internal testing, not for production

## Setup

install dependencies

```bash
npm install
```

configure `.env`

```env
PRIVATE_KEY=your_base58_encoded_private_key
RPC_ENDPOINT=https://api.mainnet-beta.solana.com
RPC_WEBSOCKET_ENDPOINT=wss://api.mainnet-beta.solana.com

TOKEN_MINT=your_token_mint_address
BUY_LOWER_PERCENT=10
BUY_UPPER_PERCENT=30
BUY_INTERVAL_MIN=30
BUY_INTERVAL_MAX=120
SELL_INTERVAL_MIN=60
SELL_INTERVAL_MAX=300

DISTRIBUTE_WALLET_NUM=5
JITO_MODE=false
SLIPPAGE=1.0
```

## Running

development

```bash
npm run build
npx ts-node src/index.ts
```

production

```bash
npm run build
node dist/index.js
```

## What This Is

HAVOC (Mayhem Mode v2) randomly supplements liquidity during the first 24 hours

operates on rotated SOL from previous HAVOC cycles that feed asymmetrical buy pressure into the upper bonding curve via liquidity flywheel that cycles profit into the next target

## How It Works

1. split SOL across N wallets
2. each runs randomized buy/sell cycles tracking Mayhem activity
3. timing and amounts intentionally unpredictable
4. operates during the same window

coordinates with Mayhem to amplify bonding curve pressure

## Parameters

- `BUY_LOWER_PERCENT` / `BUY_UPPER_PERCENT`: buy amount as % of wallet
- `BUY_INTERVAL_MIN/MAX`: wait time between acquisition (seconds)
- `SELL_INTERVAL_MIN/MAX`: wait time between distribution (seconds)
- `DISTRIBUTE_WALLET_NUM`: number of nodes to deploy
- `JITO_MODE`: use Jito for transaction execution

## Notes

- internal testing, do not distribute
- designed for Mayhem Mode tokens only (\`is_mayhem_mode = true\`)
- gas fees significant, calculate runway before deployment
