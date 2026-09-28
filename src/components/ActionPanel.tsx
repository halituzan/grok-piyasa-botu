'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtPct, fmtUsd } from '@/lib/format';
import {
  buildSwapTransaction,
  getQuote,
  solscanTxUrl,
  summarizeQuote,
  type FeeEstimate,
} from '@/lib/jupiter';
import { PAPER_FEE_USD } from '@/lib/paper';
import { SOL_DECIMALS, SOL_MINT } from '@/lib/tokens';
import type { Mode, PaperState, RiskSettings, TokenInfo, Trade, TradeKind } from '@/lib/types';

export interface ActionSelection {
  kind: TradeKind;
  mint: string;
  toMint?: string;
  nonce: number;
}

interface Props {
  mode: Mode;
  basket: TokenInfo[];
  prices: Map<string, number>;
  solPrice: number | null;
  risk: RiskSettings;
  paper: PaperState;
  runPaperTrade: (params: {
    kind: TradeKind;
    mint: string;
    symbol: string;
    toMint?: string;
    toSymbol?: string;
    usd: number;
    prices: Map<string, number>;
  }) => { ok: boolean; error?: string };
  addLiveTrade: (trade: Trade) => void;
  selection: ActionSelection | null;
}

type Status =
  | { type: 'idle' }
  | { type: 'info'; text: string }
  | { type: 'error'; text: string }
  | { type: 'success'; text: string; signature?: string };

const KIND_LABELS: Record<TradeKind, string> = {
  buy: 'AL',
  sell: 'SAT',
  rotate: 'ROTASYON',
};

export default function ActionPanel({
  mode,
  basket,
  prices,
  solPrice,
  risk,
  paper,
  runPaperTrade,
  addLiveTrade,
  selection,
}: Props) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [kind, setKind] = useState<TradeKind>('buy');
  const [mint, setMint] = useState<string>(basket[0]?.mint ?? '');
  const [toMint, setToMint] = useState<string>(basket[1]?.mint ?? '');
  const [usdStr, setUsdStr] = useState('10');
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fee, setFee] = useState<FeeEstimate | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const tokenByMint = useMemo(() => new Map(basket.map((t) => [t.mint, t])), [basket]);
  const token = tokenByMint.get(mint);
  const toToken = tokenByMint.get(toMint);
  const usd = Number(usdStr) || 0;

  useEffect(() => {
    if (!selection) return;
    setKind(selection.kind);
    setMint(selection.mint);
    if (selection.toMint) setToMint(selection.toMint);
    setStatus({ type: 'idle' });
  }, [selection]);

  useEffect(() => {
    if (mint && !tokenByMint.has(mint) && basket.length > 0) setMint(basket[0].mint);
    if (toMint && !tokenByMint.has(toMint) && basket.length > 1) setToMint(basket[1].mint);
  }, [basket, mint, toMint, tokenByMint]);

  const maxUsd = useMemo(() => {
    if (kind === 'buy') return paper.cashUsd;
    const pos = paper.positions[mint];
    const p = prices.get(mint) ?? 0;
    return pos ? pos.qty * p : 0;
  }, [kind, mint, paper, prices]);

  // Build quote request params for the current form values.
  const quoteParams = useCallback(() => {
    if (!token || usd <= 0) return null;
    const price = prices.get(mint);
    if (!price) return null;
    if (kind === 'buy') {
      if (!solPrice) return null;
      const lamports = BigInt(Math.floor((usd / solPrice) * 10 ** SOL_DECIMALS));
      if (lamports <= 0n) return null;
      return {
        inputMint: SOL_MINT,
        outputMint: mint,
        amount: lamports,
        outDecimals: token.decimals,
      };
    }
    const raw = BigInt(Math.floor((usd / price) * 10 ** token.decimals));
    if (raw <= 0n) return null;
    if (kind === 'sell') {
      return { inputMint: mint, outputMint: SOL_MINT, amount: raw, outDecimals: SOL_DECIMALS };
    }
    if (!toToken) return null;
    return {
      inputMint: mint,
      outputMint: toToken.mint,
      amount: raw,
      outDecimals: toToken.decimals,
    };
  }, [kind, mint, prices, solPrice, toToken, token, usd]);

  // Debounced Jupiter quote for the fee/impact preview.
  const previewSeq = useRef(0);
  useEffect(() => {
    const params = quoteParams();
    setFee(null);
    if (!params) return;
    const seq = ++previewSeq.current;
    setFeeLoading(true);
    const t = setTimeout(async () => {
      try {
        const quote = await getQuote({
          inputMint: params.inputMint,
          outputMint: params.outputMint,
          amount: params.amount,
          slippageBps: risk.slippageBps,
        });
        if (previewSeq.current === seq) {
          setFee(summarizeQuote(quote, params.outDecimals, solPrice));
        }
      } catch {
        if (previewSeq.current === seq) setFee(null);
      } finally {
        if (previewSeq.current === seq) setFeeLoading(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [quoteParams, risk.slippageBps, solPrice]);

  const executePaper = () => {
    if (!token) return;
    const res = runPaperTrade({
      kind,
      mint,
      symbol: token.symbol,
      toMint: kind === 'rotate' ? toMint : undefined,
      toSymbol: kind === 'rotate' ? toToken?.symbol : undefined,
      usd,
      prices,
    });
    setStatus(
      res.ok
        ? {
            type: 'success',
            text: `Paper ${KIND_LABELS[kind]} gerçekleşti: ${fmtUsd(usd)} ${token.symbol}${
              kind === 'rotate' && toToken ? ` → ${toToken.symbol}` : ''
            }`,
          }
        : { type: 'error', text: res.error ?? 'İşlem başarısız.' }
    );
  };

  const executeLive = async () => {
    if (!token || !publicKey) return;
    setBusy(true);
    setStatus({ type: 'info', text: 'Jupiter fiyat teklifi alınıyor…' });
    try {
      const params = quoteParams();
      if (!params) throw new Error('Geçersiz işlem parametreleri.');
      const quote = await getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: risk.slippageBps,
      });
      setStatus({ type: 'info', text: 'Swap işlemi hazırlanıyor…' });
      const tx = await buildSwapTransaction(quote, publicKey.toBase58());
      setStatus({ type: 'info', text: 'Cüzdanınızda imzalayın…' });
      const signature = await sendTransaction(tx, connection);

      const summary = summarizeQuote(quote, params.outDecimals, solPrice);
      const trade: Trade = {
        id: signature,
        ts: Date.now(),
        mode: 'live',
        kind,
        symbol: token.symbol,
        toSymbol: kind === 'rotate' ? toToken?.symbol : kind === 'sell' ? 'SOL' : undefined,
        qty: kind === 'buy' ? summary.outAmountUi : Number(quote.inAmount) / 10 ** token.decimals,
        priceUsd: prices.get(mint) ?? 0,
        usdValue: usd,
        feeUsd: summary.networkFeeUsd ?? 0,
        slippageBps: risk.slippageBps,
        signature,
        note:
          kind === 'buy'
            ? `SOL → ${token.symbol}`
            : kind === 'sell'
              ? `${token.symbol} → SOL`
              : `${token.symbol} → ${toToken?.symbol}`,
      };
      addLiveTrade(trade);
      setStatus({
        type: 'success',
        text: 'İşlem gönderildi. Onay durumunu Solscan üzerinden izleyin.',
        signature,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      setStatus({
        type: 'error',
        text: msg.includes('User rejected')
          ? 'İşlem cüzdanda reddedildi.'
          : `Hata: ${msg.slice(0, 180)}`,
      });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const submit = () => {
    setStatus({ type: 'idle' });
    if (!token || usd <= 0) {
      setStatus({ type: 'error', text: 'Geçerli bir tutar girin.' });
      return;
    }
    if (kind === 'rotate' && mint === toMint) {
      setStatus({ type: 'error', text: 'Kaynak ve hedef token aynı olamaz.' });
      return;
    }
    if (mode === 'paper') {
      executePaper();
      return;
    }
    if (!connected || !publicKey) {
      setStatus({ type: 'error', text: 'Canlı işlem için önce cüzdan bağlayın.' });
      return;
    }
    setConfirmOpen(true);
  };

  const feeFallbackUsd = PAPER_FEE_USD + (usd * risk.slippageBps) / 10_000 / 2;

  return (
    <div className="card">
      <div className="border-b border-ink-700 px-4 py-3">
        <h2 className="card-title">İşlem Paneli</h2>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex rounded-lg border border-ink-600 p-0.5 text-sm">
          {(['buy', 'sell', 'rotate'] as TradeKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setStatus({ type: 'idle' });
              }}
              className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition-colors ${
                kind === k
                  ? k === 'buy'
                    ? 'bg-up/15 text-up'
                    : k === 'sell'
                      ? 'bg-down/15 text-down'
                      : 'bg-accent/20 text-violet-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">
            {kind === 'rotate' ? 'Kaynak token' : 'Token'}
            <select className="input mt-1" value={mint} onChange={(e) => setMint(e.target.value)}>
              {basket.map((t) => (
                <option key={t.mint} value={t.mint}>
                  {t.symbol}
                  {paper.positions[t.mint] ? ' (pozisyon)' : ''}
                </option>
              ))}
            </select>
          </label>
          {kind === 'rotate' && (
            <label className="block text-xs text-slate-400">
              Hedef token
              <select
                className="input mt-1"
                value={toMint}
                onChange={(e) => setToMint(e.target.value)}
              >
                {basket
                  .filter((t) => t.mint !== mint)
                  .map((t) => (
                    <option key={t.mint} value={t.mint}>
                      {t.symbol}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="block text-xs text-slate-400">
            Tutar (USD)
            <div className="mt-1 flex gap-1.5">
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={usdStr}
                onChange={(e) => setUsdStr(e.target.value)}
              />
              {mode === 'paper' && (
                <button
                  className="btn-ghost shrink-0 !px-2 text-xs"
                  onClick={() => setUsdStr(maxUsd.toFixed(2))}
                  title={kind === 'buy' ? 'Tüm nakit' : 'Tüm pozisyon'}
                >
                  Max
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-slate-400">
          <div className="flex justify-between py-0.5">
            <span>Tahmini ağ ücreti</span>
            <span className="font-mono text-slate-300">
              {fee
                ? `~${fee.networkFeeSol} SOL${fee.networkFeeUsd ? ` (${fmtUsd(fee.networkFeeUsd)})` : ''}`
                : feeLoading
                  ? '…'
                  : `~${fmtUsd(feeFallbackUsd)} (tahmin)`}
            </span>
          </div>
          <div className="flex justify-between py-0.5">
            <span>Fiyat etkisi (Jupiter)</span>
            <span
              className={`font-mono ${fee && fee.priceImpactPct > 1 ? 'text-amber-400' : 'text-slate-300'}`}
            >
              {fee ? fmtPct(fee.priceImpactPct, false) : feeLoading ? '…' : '—'}
            </span>
          </div>
          {fee && (
            <div className="flex justify-between py-0.5">
              <span>Beklenen çıktı (min)</span>
              <span className="font-mono text-slate-300">
                {fee.outAmountUi.toLocaleString('en-US', { maximumFractionDigits: 4 })} (
                {fee.minOutAmountUi.toLocaleString('en-US', { maximumFractionDigits: 4 })})
              </span>
            </div>
          )}
          <div className="flex justify-between py-0.5">
            <span>Slippage toleransı</span>
            <span className="font-mono text-slate-300">{risk.slippageBps} bps</span>
          </div>
        </div>

        <button
          className={mode === 'live' ? 'btn-danger w-full' : 'btn-primary w-full'}
          onClick={submit}
          disabled={busy || basket.length === 0}
        >
          {busy
            ? 'İşleniyor…'
            : mode === 'live'
              ? `⚡ CANLI ${KIND_LABELS[kind]} — cüzdanda imzala`
              : `📝 Paper ${KIND_LABELS[kind]}`}
        </button>

        {status.type !== 'idle' && (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              status.type === 'error'
                ? 'bg-down/10 text-red-300'
                : status.type === 'success'
                  ? 'bg-up/10 text-emerald-300'
                  : 'bg-ink-800 text-slate-300'
            }`}
          >
            {status.text}
            {status.type === 'success' && status.signature && (
              <>
                {' '}
                <a
                  className="underline hover:text-white"
                  href={solscanTxUrl(status.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Solscan&apos;de görüntüle ↗
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {confirmOpen && token && (
        <ConfirmLiveModal
          summary={{
            action: KIND_LABELS[kind],
            detail:
              kind === 'buy'
                ? `SOL → ${token.symbol}`
                : kind === 'sell'
                  ? `${token.symbol} → SOL`
                  : `${token.symbol} → ${toToken?.symbol ?? '?'}`,
            usd,
            impact: fee?.priceImpactPct ?? null,
            feeText: fee
              ? `~${fee.networkFeeSol} SOL`
              : `~${fmtUsd(feeFallbackUsd)} (tahmin)`,
            slippageBps: risk.slippageBps,
          }}
          busy={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={executeLive}
        />
      )}
    </div>
  );
}

function ConfirmLiveModal({
  summary,
  busy,
  onCancel,
  onConfirm,
}: {
  summary: {
    action: string;
    detail: string;
    usd: number;
    impact: number | null;
    feeText: string;
    slippageBps: number;
  };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md border-down/40 p-5">
        <h3 className="text-lg font-bold text-white">⚠️ Canlı işlem onayı</h3>
        <p className="mt-1 text-sm text-slate-400">
          Bu işlem <strong className="text-red-300">gerçek fonlarla</strong> yapılacak ve
          cüzdanınızda imzalanacaktır. Meme coinler aşırı oynaktır; kâr garantisi yoktur.
        </p>
        <div className="mt-4 space-y-1.5 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">İşlem</span>
            <span className="font-semibold text-white">
              {summary.action} · {summary.detail}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tutar</span>
            <span className="font-mono text-white">{fmtUsd(summary.usd)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tahmini ücret</span>
            <span className="font-mono text-white">{summary.feeText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Fiyat etkisi</span>
            <span className="font-mono text-white">
              {summary.impact === null ? '—' : fmtPct(summary.impact, false)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Slippage</span>
            <span className="font-mono text-white">{summary.slippageBps} bps</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel} disabled={busy}>
            Vazgeç
          </button>
          <button className="btn-danger flex-1" onClick={onConfirm} disabled={busy}>
            {busy ? 'İşleniyor…' : 'Onayla ve imzala'}
          </button>
        </div>
      </div>
    </div>
  );
}
