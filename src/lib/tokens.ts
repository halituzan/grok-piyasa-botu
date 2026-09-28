import type { TokenInfo } from './types';

/** Wrapped SOL mint (native SOL for Jupiter routing). */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOL_DECIMALS = 9;

/**
 * Default meme basket. Mint addresses are the canonical Solana mainnet mints.
 * Verify against a block explorer before adding new ones.
 */
export const DEFAULT_BASKET: TokenInfo[] = [
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    group: 'kopek',
    builtin: true,
  },
  {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    group: 'kopek',
    builtin: true,
  },
  {
    mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    symbol: 'PENGU',
    name: 'Pudgy Penguins',
    decimals: 6,
    group: 'hayvan',
    builtin: true,
  },
  {
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    symbol: 'POPCAT',
    name: 'Popcat',
    decimals: 9,
    group: 'kedi',
    builtin: true,
  },
  {
    mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    symbol: 'MEW',
    name: 'cat in a dogs world',
    decimals: 5,
    group: 'kedi',
    builtin: true,
  },
  {
    mint: '2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump',
    symbol: 'PNUT',
    name: 'Peanut the Squirrel',
    decimals: 6,
    group: 'hayvan',
    builtin: true,
  },
  {
    mint: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82',
    symbol: 'BOME',
    name: 'BOOK OF MEME',
    decimals: 6,
    group: 'absurt',
    builtin: true,
  },
  {
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
    symbol: 'FARTCOIN',
    name: 'Fartcoin',
    decimals: 6,
    group: 'absurt',
    builtin: true,
  },
  {
    mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY',
    symbol: 'MOODENG',
    name: 'Moo Deng',
    decimals: 6,
    group: 'hayvan',
    builtin: true,
  },
  {
    mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump',
    symbol: 'GOAT',
    name: 'Goatseus Maximus',
    decimals: 6,
    group: 'hayvan',
    builtin: true,
  },
  {
    mint: '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9',
    symbol: 'GIGA',
    name: 'Gigachad',
    decimals: 5,
    group: 'absurt',
    builtin: true,
  },
  {
    mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
    symbol: 'TRUMP',
    name: 'OFFICIAL TRUMP',
    decimals: 6,
    group: 'politik',
    builtin: true,
  },
];

export const GROUP_LABELS: Record<string, string> = {
  kopek: 'Köpek',
  kedi: 'Kedi',
  hayvan: 'Hayvan',
  absurt: 'Absürt',
  politik: 'Politik',
};
