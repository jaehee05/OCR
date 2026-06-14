import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12) ?? null,
  });
}
