# Shiba Claim Program

## Tokenomics Model According to Report
* 2% of each sell is collected as taxes
* 50% Liquidity Pool, 35% Marketing and 15% Free NFT holders for life
* 500 Free NFTs

## Implementation Details
* Use Token 2022 Extension [Transfer Fees](https://spl.solana.com/token-2022/extensions#transfer-fees) 
* Implications are there is a 2% on all buy, sells and transfers ( BERN & SolarMoonSol use the same mechanisms for taxing )

## Flow
1. Transfer occurs 
2. Tokens are witheld in recipient accounts
3. Daily task runner will call `withdrawFeeFromTokenAccounts` and deposit into tokenATA (PDA of the claim program)
4. Marketing and Liquidity wallets can withdraw their associated shares
5. NFT holders will register and be able to claim
6. Although they only claim 98% of what they are allocated, overtime this difference is marginal as each subsequent tax from the claim will be included in the subsequent claims.

## Alternatives
* This distribution of tokens can also be done manually by harvesting the tokens and airdropping the tokens to LP wallet, Marketing wallets and NFT holders.

## Tests
```
anchor test
```
