'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';

export function useSolBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        // RPC hiccup — keep the last known balance
      }
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connection, publicKey]);

  return balance;
}
