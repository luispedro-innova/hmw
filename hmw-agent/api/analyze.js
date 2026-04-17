export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recordId, hmwText } = req.body;
  if (!recordId || !hmwText) return res.status(400).json({ error: 'Missing recordId or hmwText' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const AIRTABLE_KEY  = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE= process.env.AIRTABLE_TABLE_NAME;

  if (!ANTHROPIC_KEY || !AIRTABLE_KEY || !AIRTABLE_BASE || !AIRTABLE_TABLE) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  // ── 1. Call Claude with web search ──────────────────────────────────────────
  const systemPrompt = `You are a venture building analyst specializing in Latin American markets. 
Your job is to conduct a rapid pre-feasibility analysis of a problem space described as a "How Might We" (HMW) question.

You MUST search the web thoroughly before answering. Search for:
- Existing startups or companies solving this problem globally and in LatAm
- Market size data (TAM/SAM/SOM if available)
- Investment activity in this space (funding rounds, VCs interested)
- Growth trends and signals
- Regulatory or structural barriers in LatAm

After your research, return a JSON object with EXACTLY these fields and no other text:
{
  "qualitative_analysis": "string — 400-600 word analysis in English covering: problem clarity, existing solutions landscape, market size evidence, growth signals, LatAm-specific context, and your overall assessment. Be direct and opinionated.",
  "market_size_score": number between 1 and 10,
  "competition_score": number between 1 and 10 (1=red ocean, 10=blue ocean),
  "growth_potential_score": number between 1 and 10,
  "ocean_recommendation": "BLUE OCEAN" or "RED OCEAN" or "PURPLE OCEAN",
  "score_rationale": "string — 2-3 sentences explaining the scores"
}

Scoring guide:
- market_size_score: 1=tiny niche, 10=massive addressable market
- competition_score: 1=extremely crowded, 10=virtually no competition
- growth_potential_score: 1=declining/saturated, 10=explosive growth potential
- ocean_recommendation: BLUE=untapped opportunity, RED=crowded, PURPLE=competitive but differentiable

Return ONLY the JSON object. No markdown, no preamble, no explanation outside the JSON.`;

  const userMessage = `Analyze this HMW question for venture building potential in Latin America:

"${hmwText}"

Search the web for relevant market data, existing solutions, and growth signals. Then provide your structured analysis.`;

  let claudeResponse;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14,web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        thinking: { type: 'enabled', budget_tokens: 10000 },
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    // Extract the final text block (after tool use and thinking)
    const textBlocks = data.content.filter(b => b.type === 'text');
    if (!textBlocks.length) throw new Error('No text response from Claude');
    claudeResponse = textBlocks[textBlocks.length - 1].text.trim();
  } catch (err) {
    return res.status(500).json({ error: `Claude call failed: ${err.message}` });
  }

  // ── 2. Parse JSON from Claude ────────────────────────────────────────────────
  let analysis;
  try {
    // Strip markdown fences if Claude adds them despite instructions
    const clean = claudeResponse.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    analysis = JSON.parse(clean);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to parse Claude response as JSON', raw: claudeResponse });
  }

  // ── 3. Write results back to Airtable ───────────────────────────────────────
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const airtablePayload = {
    fields: {
      'Análisis_Cualitativo': analysis.qualitative_analysis,
      'Market_Size_Score':    analysis.market_size_score,
      'Competencia_Score':    analysis.competition_score,
      'Crecimiento_Score':    analysis.growth_potential_score,
      'Ocean_Recomendacion':  analysis.ocean_recommendation,
      'Score_Rationale':      analysis.score_rationale,
      'Fecha_Análisis':       now
    }
  };

  try {
    const atRes = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(airtablePayload)
      }
    );

    if (!atRes.ok) {
      const err = await atRes.text();
      throw new Error(`Airtable error: ${atRes.status} — ${err}`);
    }

    const atData = await atRes.json();
    return res.status(200).json({ success: true, record: atData, analysis });
  } catch (err) {
    return res.status(500).json({ error: `Airtable write failed: ${err.message}`, analysis });
  }
}
