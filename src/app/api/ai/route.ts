import { NextResponse } from 'next/server';
import {
  decideHeuristic,
  sanitizeDecision,
  type AiResponse,
  type AiSnapshot,
} from '@/lib/autopilot';

export const runtime = 'nodejs';

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.x.ai/v1';
const AI_MODEL = process.env.AI_MODEL || 'grok-4-fast';
const AI_TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `Sen bir Solana meme-coin rotasyon botunun karar motorusun.
Felsefe: favori coin yok; göreli güç zayıflayan tutulmaz, sepetteki güçlüye rotasyon yapılır.
Kurallar:
- Yalnızca verilen sepetteki mint adreslerini kullan.
- Coin başına maksimum yüzdeyi ve nakit bakiyesini aşma.
- Her işlemin maliyeti vardır (ağ ücreti + slippage). Beklenen kenar maliyeti anlamlı biçimde aşmıyorsa "hold" seç.
- Aşırı işlem yapma; net sinyal yoksa "hold" en iyi karardır.
- SADECE şu şemaya uyan tek bir JSON nesnesi döndür, başka hiçbir metin yazma:
{"action":"buy"|"sell"|"rotate"|"hold","mint":"<mint>","toMint":"<mint>","usd":<number>,"reason":"<kısa Türkçe gerekçe>"}
"hold" için mint/toMint/usd alanlarını atla. "buy"/"sell" için toMint atla.`;

async function callLlm(apiKey: string, snapshot: AiSnapshot): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Piyasa ve portföy durumu (JSON):\n${JSON.stringify(snapshot)}\n\nKararını ver.`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM boş yanıt döndürdü');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let snapshot: AiSnapshot;
  try {
    snapshot = (await req.json()) as AiSnapshot;
    if (!Array.isArray(snapshot.rows) || !Array.isArray(snapshot.positions)) {
      throw new Error('bad snapshot');
    }
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
  }

  const apiKey = process.env.XAI_API_KEY || process.env.AI_API_KEY;

  if (apiKey) {
    try {
      const raw = await callLlm(apiKey, snapshot);
      const decision = sanitizeDecision(raw, snapshot);
      if (decision) {
        const body: AiResponse = { decision, source: 'llm', model: AI_MODEL };
        return NextResponse.json(body);
      }
      // Geçersiz LLM kararı — sezgisel motora düş.
    } catch {
      // LLM erişilemedi / zaman aşımı — sezgisel motora düş.
    }
  }

  const body: AiResponse = { decision: decideHeuristic(snapshot), source: 'heuristic' };
  return NextResponse.json(body);
}
