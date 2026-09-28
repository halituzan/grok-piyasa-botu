'use client';

import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useState } from 'react';
import { lookupTokenMeta } from '@/lib/market';
import { DEFAULT_BASKET } from '@/lib/tokens';
import type { TokenInfo } from '@/lib/types';

interface Props {
  allTokens: TokenInfo[];
  disabled: string[];
  onToggle: (mint: string) => void;
  onAdd: (token: TokenInfo) => void;
  onRemove: (mint: string) => void;
}

export default function BasketEditor({ allTokens, disabled, onToggle, onAdd, onRemove }: Props) {
  const { connection } = useConnection();
  const [open, setOpen] = useState(false);
  const [newMint, setNewMint] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabledSet = new Set(disabled);
  const builtinMints = new Set(DEFAULT_BASKET.map((t) => t.mint));

  const addToken = async () => {
    setError(null);
    const mintStr = newMint.trim();
    let pk: PublicKey;
    try {
      pk = new PublicKey(mintStr);
    } catch {
      setError('Geçersiz mint adresi.');
      return;
    }
    if (allTokens.some((t) => t.mint === mintStr)) {
      setError('Bu token zaten sepette.');
      return;
    }
    setAdding(true);
    try {
      const info = await connection.getParsedAccountInfo(pk);
      const data = info.value?.data;
      const parsed =
        data && typeof data === 'object' && 'parsed' in data
          ? (data.parsed as { type?: string; info?: { decimals?: number } })
          : null;
      if (!parsed || parsed.type !== 'mint' || parsed.info?.decimals === undefined) {
        setError('Adres bir SPL token mint hesabı değil.');
        return;
      }
      const meta = await lookupTokenMeta(mintStr);
      if (!meta) {
        setError('DexScreener üzerinde likit bir pazar bulunamadı.');
        return;
      }
      onAdd({
        mint: mintStr,
        symbol: meta.symbol,
        name: meta.name,
        decimals: parsed.info.decimals,
        group: 'absurt',
        builtin: false,
      });
      setNewMint('');
    } catch {
      setError('RPC sorgusu başarısız oldu. Tekrar deneyin.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <h2 className="card-title">Sepeti Düzenle</h2>
        <span className="text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="border-t border-ink-700 p-4">
          <div className="flex flex-wrap gap-2">
            {allTokens.map((t) => {
              const active = !disabledSet.has(t.mint);
              return (
                <span key={t.mint} className="inline-flex items-center">
                  <button
                    onClick={() => onToggle(t.mint)}
                    className={`badge !px-2.5 !py-1 transition-colors ${
                      active
                        ? 'bg-accent/20 text-violet-200 hover:bg-accent/30'
                        : 'bg-ink-800 text-slate-500 line-through hover:text-slate-300'
                    }`}
                    title={`${t.name} — ${t.mint}`}
                  >
                    {t.symbol}
                  </button>
                  {!builtinMints.has(t.mint) && (
                    <button
                      onClick={() => onRemove(t.mint)}
                      className="ml-0.5 text-xs text-slate-500 hover:text-down"
                      title="Sepetten kaldır"
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="input font-mono"
              placeholder="SPL token mint adresi ekle…"
              value={newMint}
              onChange={(e) => setNewMint(e.target.value)}
            />
            <button className="btn-primary shrink-0" onClick={addToken} disabled={adding}>
              {adding ? '…' : 'Ekle'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          <p className="mt-2 text-[11px] text-slate-500">
            Mint adresini eklemeden önce blok gezgininde doğrulayın. Sahte (kopya) mintler
            yaygındır.
          </p>
        </div>
      )}
    </div>
  );
}
