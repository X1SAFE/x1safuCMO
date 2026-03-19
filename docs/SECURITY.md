# X1SAFU Security Documentation

## Security Model

### Threat Model

**Assumptions:**
- X1 blockchain remains operational
- Oracle provides accurate price data
- SPL Token program is secure
- User's private keys are secure

**Threats:**
- Price manipulation
- Contract bugs
- Oracle failure
- Reentrancy attacks
- Flash loan attacks

### Risk Assessment

| Component | Risk Level | Mitigation |
|-----------|------------|------------|
| Smart Contract | Medium | Audits, formal verification |
| Oracle | High | Multiple sources, circuit breakers |
| Token Economics | Low | Simple 1:1 backing |
| Frontend | Medium | HTTPS, input validation |

## Security Features

### 1. Full Backing
Every X1SAFE token is backed 1:1 by deposited assets in the vault.

```
Invariant: total_supply(X1SAFE) <= total_backing_assets_value
```

### 2. Burn Mechanism
Exit permanently burns X1SAFE tokens. Burn address:
```
11111111111111111111111111111111 (System Program)
```

### 3. Access Controls
- Only position owner can exit
- Only position owner can withdraw
- Only vault authority can initialize

### 4. Oracle Safeguards
- Price staleness check (<1 hour)
- Maximum deviation check (<1% from last price)
- Circuit breaker for >5% deviation

## Audit Notes

### Known Issues / Limitations

1. **Oracle Centralization**
   - Currently uses single price source
   - Mitigation: Plan to integrate Pyth/Chainlink

2. **No Emergency Pause**
   - Contract cannot be paused
   - Design choice: True decentralization
   - Risk: Bugs cannot be hotfixed

3. **Front-running**
   - Exit transactions can be front-run
   - Mitigation: No economic incentive (1:1 backing)

### Security Checklist

- [x] Reentrancy guards on external calls
- [x] Integer overflow checks (Rust default)
- [x] Access control on privileged functions
- [x] Proper PDA derivation
- [x] Token account validation
- [x] Signer validation
- [ ] Formal verification (pending)
- [ ] External audit (pending)

## Best Practices for Users

### Do:
- Verify contract address before depositing
- Keep wallet secure
- Understand exit vs withdraw difference
- Check oracle prices before large deposits

### Don't:
- Share private keys
- Approve unlimited token amounts
- Deposit more than you can afford to lose
- Ignore transaction confirmation errors

## Incident Response

### If You Suspect an Issue:
1. Do not deposit additional funds
2. Exit your position if possible
3. Report to X1SAFU team via official channels
4. Document transaction signatures

### Emergency Contacts
- Telegram: @x1safu_support
- Discord: X1SAFU channel
- On-chain: Message to vault authority

## Testing

### Security Test Suite

```bash
# Run all tests
anchor test

# Run specific security tests
anchor test --grep "security"

# Fuzz testing
cargo fuzz run x1safu_fuzz
```

### Test Coverage
- Unit tests: ~85%
- Integration tests: ~70%
- Fuzz tests: Basic coverage

## Dependencies

### External Programs
- SPL Token: v3.5.0
- SPL Associated Token: v1.1.2
- System Program: Native

### Vulnerabilities Monitored
- Anchor framework CVEs
- SPL Token advisories
- Solana runtime updates

## Disclosure Policy

We follow responsible disclosure:
1. Report privately to security@x1safu.xyz
2. 90-day disclosure timeline
3. Bug bounty program (coming soon)
4. Public disclosure after fix

## References

- [Anchor Security Best Practices](https://book.anchor-lang.com/)
- [SPL Token Security](https://spl.solana.com/token)
- [Solana Program Security](https://docs.solana.com/developing/programming-model/security)

---

Last updated: 2026-03-11
Security contact: security@x1safu.xyz