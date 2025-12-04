# HAVOC - Mayhem Mode v2

Lightweight bot for amplifying bonding curve liquidity on Pump.fun Mayhem Mode tokens with distributed wallet coordination and low-latency transaction landing.

### Highlights
- Multi-wallet randomized buy/sell cycles
- Automated liquidity supplementation during first 24 hours
- Integrated low-latency transaction landing with Jito, Nozomi, 0slot, BlockRazor, bloXroute
- Configurable timing and position sizing

This bot can route signed transactions to one or more landing providers in parallel for faster inclusion.

- Warm up connections (health pings) before burst submissions.
- Use fresh recent blockhashes and avoid reusing expired ones.
- Prefer parallel submission for time-sensitive trades.
- Monitor provider responses and adjust routing in real time.

### Transaction
```typescript
const { solAmt, sellPercentage } = await getMayhemConfig();

async function main() {
  const mint = '2az8Wzi99L8Ee5TGXoyPXRnRoKToqq6dHN8DgVZEpump';

  // Pull dynamic values from mayhem
  const solAmt = mayhem(data.solAmt);     
  const sellPercentage = mayhem(data.solAmt);

  const sdk = new PumpSwapSDK();
  await sdk.buy(new PublicKey(mint), wallet_1.publicKey, solAmt);
  await sdk.sell_percentage(new PublicKey(mint), wallet_1.publicKey, sellPercentage);
  await sdk.sell_exactAmount(new PublicKey(mint), wallet_1.publicKey, 1000);
}
```

## Notes

- Works best if `is_mayhem_mode = true`
- Internal testing, not for production use
