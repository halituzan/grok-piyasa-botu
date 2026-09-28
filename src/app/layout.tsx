import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Grok Piyasa Botu — Solana Meme Rotasyon',
  description:
    'Solana meme-coin sepeti için göreli güç rotasyon botu. Paper trading varsayılan; canlı işlemler yalnızca kendi cüzdanınızda imzalanır.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
