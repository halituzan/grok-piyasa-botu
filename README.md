# Grok Piyasa Botu — Solana Meme Rotasyon Botu

Solana meme-coin sepeti için **göreli güç rotasyon** botu. Felsefe: favori coin yok — benzer memeler aynı varlığın farklı bahis oranları gibidir. Zayıflayan tutulmaz, sepetteki en güçlüye rotasyon yapılır (AL / SAT / ROTASYON).

- **Paper-first:** Uygulama her zaman Paper (simülasyon) modunda açılır. Başlangıç bakiyesi 50 USD (ayarlanabilir).
- **Canlı hazır:** Jupiter aggregator üzerinden quote → swap işlemi kurulur, imza **yalnızca sizin cüzdanınızda** atılır.
- **Güvenlik:** Özel anahtar veya seed phrase asla istenmez, saklanmaz, loglanmaz, iletilmez.

> ⚠️ Bu proje yatırım tavsiyesi değildir. Meme coinler aşırı oynaktır; yatırdığınız tutarın tamamını kaybedebilirsiniz. Kâr garantisi yoktur.

## Özellikler

- **Sepet tablosu:** 12 likit Solana meme tokenı (BONK, WIF, PENGU, POPCAT, MEW, PNUT, BOME, FARTCOIN, MOODENG, GOAT, GIGA, TRUMP) — fiyat, 5d/1s/24s değişim, likidite, göreli güç skoru (z), öneri.
- **Rotasyon motoru:** Kısa vadeli momentum (5d/1s/6s/24s ağırlıklı) + hacim/likidite aktivitesi, sepet içinde z-skoruna normalize edilir. Aynı gruptaki (köpek, kedi, hayvan…) daha güçlü meme önceliklidir.
- **İşlem paneli:** AL / SAT / ROTASYON A→B, USD tutar, Jupiter fiyat teklifi ile tahmini ağ ücreti, fiyat etkisi ve minimum çıktı.
- **Paper portföy:** localStorage üzerinde tutulur; dolum fiyatı = anlık fiyat + slippage payı + sabit ağ ücreti tahmini. PnL, günlük gerçekleşen kâr/zarar takibi.
- **Canlı mod:** Açık onay gerektirir (mod geçişinde uyarı + her swap öncesi onay penceresi + kalıcı risk bandı). İşlem sonrası imza ve Solscan bağlantısı gösterilir.
- **Risk ayarları:** Coin başına maksimum %, günlük zarar limiti, slippage (bps), paper başlangıç bakiyesi.
- **🤖 AI Otopilot:** Belirlediğiniz aralıkta piyasa + portföy görüntüsünü AI karar motoruna gönderir; ücret ve slippage maliyetini hesaba katarak AL / SAT / ROTASYON / BEKLE kararını kendisi verir ve paper portföyde anında uygular. Alt limit (stop) ve üst limit (kâr hedefi) koyarsınız: toplam değer bu sınırlara ulaşınca tüm pozisyonlar satılır ve otopilot durur. Canlı işlemler asla otomatik yapılmaz; her canlı swap kullanıcı tıklaması ve cüzdan imzası ister.
- **Düzenlenebilir sepet:** Varsayılan tokenları kapatabilir, mint adresi ile yeni token ekleyebilirsiniz (decimals RPC üzerinden doğrulanır).

## Yerelde çalıştırma

Gereksinim: Node.js 18.18+ (öneri: 20+).

```bash
npm install
npm run dev
# http://localhost:3000
```

Üretim derlemesi:

```bash
npm run build
npm run start
```

## Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayın:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC uç noktası. Public uç nokta hız limitlidir; üretimde Helius / Triton / QuickNode gibi bir sağlayıcı kullanın. |
| `NEXT_PUBLIC_JUPITER_BASE_URL` | `https://lite-api.jup.ag` | Jupiter API taban adresi. Ücretsiz katman `lite-api.jup.ag`; API anahtarınız varsa `https://api.jup.ag` kullanabilirsiniz. |
| `NEXT_PUBLIC_JUPITER_API_KEY` | boş | İsteğe bağlı Jupiter API anahtarı (`x-api-key` başlığı ile gönderilir). |
| `XAI_API_KEY` | boş | İsteğe bağlı xAI (Grok) API anahtarı. Yalnızca sunucu tarafında (`/api/ai`) kullanılır, tarayıcıya asla gönderilmez. Ayarlanırsa otopilot kararlarını Grok LLM verir; yoksa yerleşik sezgisel motor devrededir. |
| `AI_BASE_URL` | `https://api.x.ai/v1` | OpenAI uyumlu herhangi bir chat-completions uç noktası. |
| `AI_MODEL` | `grok-4-fast` | Kullanılacak model adı. |

Depoda hiçbir gizli bilgi (secret) tutulmaz. `XAI_API_KEY` yalnızca sunucu ortam değişkenidir (`NEXT_PUBLIC_` öneki yoktur), istemciye sızmaz.

## AI Otopilot nasıl karar verir?

1. Her karar aralığında (varsayılan 45 sn) sepetin skor tablosu, açık pozisyonlar, nakit, risk ayarları ve limitler `/api/ai` uç noktasına gönderilir.
2. `XAI_API_KEY` tanımlıysa karar Grok LLM'den istenir (katı JSON şeması ile). Anahtar yoksa, LLM hata verirse veya karar risk sınırlarını geçemezse **yerleşik sezgisel motor** devreye girer.
3. Her karar sunucuda ve istemcide ayrıca doğrulanır: coin başına maksimum %, nakit bakiyesi ve minimum işlem tutarı aşılamaz.
4. **Ücret farkındalığı:** İşlem yalnızca beklenen kenar (göreli güç farkı) gidiş-dönüş maliyetini (ağ ücreti + slippage payı) `min. kenar/maliyet` katsayısı kadar aşıyorsa yapılır; aksi halde BEKLE.
5. **Alt/üst limit:** Toplam portföy değeri alt limite (stop) düşerse veya üst limite (hedef) ulaşırsa tüm pozisyonlar satılır ve otopilot kendini kapatır.
6. Tüm kararlar gerekçesiyle birlikte panel içindeki günlüğe yazılır.

Otopilot yalnızca **paper** modda işlem uygular. Canlı modda otomatik işlem güvenlik gereği devre dışıdır; her canlı swap kullanıcının tıklaması ve cüzdan imzası ile yapılır.

## Cüzdan güvenliği

- Bağlantı yalnızca [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) ile yapılır. Wallet Standard destekleyen tüm cüzdanlar (Phantom, Solflare, Backpack…) otomatik algılanır.
- Uygulama **hiçbir zaman** özel anahtar, seed phrase veya keystore dosyası istemez. Böyle bir şey isteyen ekran görürseniz kullanmayı bırakın.
- Canlı swap akışı: Jupiter quote → imzasız işlem (transaction) oluşturulur → **cüzdanınız** imzalar → ağa gönderilir → imza ve Solscan bağlantısı gösterilir.
- İmza yetkisi işlem başınadır; uygulamanın fonlarınıza süreli/limitli erişimi yoktur.

## Paper ve Canlı mod farkı

| | Paper | Canlı |
| --- | --- | --- |
| Varsayılan | ✅ | ❌ (açık onay gerekir) |
| Fon | Sanal (50 USD başlangıç, ayarlanabilir) | Cüzdanınızdaki gerçek SOL/token |
| Dolum | Anlık fiyat + slippage payı + ücret tahmini | Jupiter route, zincir üstü gerçek dolum |
| Onay | Tek tıklama | Mod geçiş onayı + her swap öncesi onay + cüzdan imzası |
| Kayıt | localStorage | localStorage + zincir (Solscan bağlantısı) |

Paper portföy ve ayarlar tarayıcı localStorage'ında saklanır; sunucuya hiçbir veri gönderilmez.

## Ücretler

- **Venue:** Solana + Jupiter aggregator — en düşük maliyetli likit meme pazarları için route otomatik seçilir.
- **Ağ ücreti:** Baz ücret + öncelik ücreti, tipik olarak işlem başına ~0.0001–0.001 SOL. UI'da tahmin gösterilir.
- **Fiyat etkisi:** Jupiter quote yanıtından okunur ve işlem panelinde gösterilir; %1 üzeri vurgulanır.
- **Slippage:** Varsayılan 100 bps; risk ayarlarından değiştirilebilir.

## Veri kaynakları ve hız limitleri

- Piyasa verisi: [DexScreener](https://docs.dexscreener.com/) token API (25 sn'de bir, tek toplu istek). 429 yanıtında yenileme aralığı otomatik olarak 5 dakikaya kadar artar.
- Quote/swap: [Jupiter Swap API](https://dev.jup.ag/). Ücretsiz `lite-api` katmanı hız limitlidir; yoğun kullanım için API anahtarı alın.

## Mimari

```
src/
  app/            Next.js App Router (layout, page, providers)
  components/     Dashboard, BasketTable, ActionPanel, PortfolioPanel,
                  TradeHistory, RiskSettingsPanel, BasketEditor, Header, RiskBanner
  hooks/          useBotState (portföy/ayar/sepet), useMarketData, useSolBalance
  lib/            tokens (mint listesi), market (DexScreener), jupiter (quote/swap),
                  rotation (skorlama), paper (simülasyon motoru), storage, format, types
```

## Sepet (varsayılan mint adresleri)

| Sembol | Mint |
| --- | --- |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| WIF | `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm` |
| PENGU | `2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv` |
| POPCAT | `7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr` |
| MEW | `MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5` |
| PNUT | `2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump` |
| BOME | `ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82` |
| FARTCOIN | `9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump` |
| MOODENG | `ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY` |
| GOAT | `CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump` |
| GIGA | `63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9` |
| TRUMP | `6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN` |

Yeni mint eklemeden önce adresi bir blok gezgininde doğrulayın — kopya (sahte) mintler yaygındır.
