'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useSolBalance } from '@/hooks/useSolBalance';
import { shortAddr } from '@/lib/format';
import type { Mode } from '@/lib/types';

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export default function Header({ mode, onModeChange }: Props) {
  const { publicKey, connected } = useWallet();
  const balance = useSolBalance();

  const requestMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'live') {
      const ok = window.confirm(
        'CANLI moda geçiyorsunuz.\n\n• İşlemler gerçek para ile, kendi cüzdanınızda imzalanır.\n• Meme coinler aşırı oynaktır; tüm bakiyenizi kaybedebilirsiniz.\n• Her swap öncesi ayrıca onay istenir.\n\nDevam edilsin mi?'
      );
      if (!ok) return;
    }
    onModeChange(next);
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-ink-700 bg-ink-900/70 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-xl">🔄</span>
        <div>
          <h1 className="text-base font-bold leading-tight text-white">Grok Piyasa Botu</h1>
          <p className="text-[11px] leading-tight text-slate-500">
            Solana meme rotasyonu — favori yok, güçlüye geç
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg border border-ink-600 p-0.5 text-sm"
          role="group"
          aria-label="Mod seçimi"
        >
          <button
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              mode === 'paper' ? 'bg-accent2/20 text-accent2' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => requestMode('paper')}
          >
            📝 Paper
          </button>
          <button
            className={`rounded-md px-3 py-1 font-semibold transition-colors ${
              mode === 'live' ? 'bg-down/20 text-down' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => requestMode('live')}
          >
            ⚡ Canlı
          </button>
        </div>

        {connected && publicKey && (
          <div className="hidden items-center gap-2 rounded-lg border border-ink-600 px-3 py-1.5 text-sm sm:flex">
            <span className="font-mono text-slate-300">{shortAddr(publicKey.toBase58())}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-slate-300">
              {balance === null ? '…' : `${balance.toFixed(4)} SOL`}
            </span>
          </div>
        )}

        <WalletMultiButton />
      </div>
    </header>
  );
}
