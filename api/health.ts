export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify({
      ok: true,
      time: new Date().toISOString(),
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12) ?? null,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}
