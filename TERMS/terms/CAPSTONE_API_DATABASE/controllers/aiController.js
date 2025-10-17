import db from '../db.js';
let _fetch = globalThis.fetch;
async function ensureFetch() {
  if (!_fetch) {
    const mod = await import('node-fetch');
    _fetch = mod.default || mod;
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

function tokenizeApprox(str='') {
  return Math.ceil((str || '').length / 4);
}

export const summarize = async (req, res) => {
  try {
    const body = req.body || {};
    let narratives = Array.isArray(body.narratives) ? body.narratives.map(x => String(x || '')) : [];

    // If client didn't send narratives, allow server to gather by report_assignment_id
    const ra = body.report_assignment_id;
    if ((!narratives.length || narratives.every(n => !n.trim())) && ra) {
      const sql = `SELECT fields FROM submission WHERE report_assignment_id = ? AND status >= 2`;
      await new Promise((resolve) => {
        db.query(sql, [ra], (err, rows) => {
          if (!err && Array.isArray(rows)) {
            narratives = rows.map(r => {
              let f = {};
              try { f = typeof r.fields === 'string' ? JSON.parse(r.fields) : (r.fields || {}); } catch {}
              return String(f.narrative || f.text || '');
            }).filter(t => t && t.trim());
          }
          resolve();
        });
      });
    }
    if (!narratives.length || narratives.every(n => !n.trim())) {
      return res.status(400).json({ error: 'No narrative text provided to summarize.' });
    }

    const system = 'You are a helpful assistant for summarizing school accomplishment reports. Produce a concise, neutral summary followed by 3-5 bullet key results. Avoid names and PII, no invented details.';
    const userPrompt = [
      'Narratives:',
      narratives.map((n,i)=>`[${i+1}] ${n}`).join('\n\n')
    ].join('\n');

    // Debug logging
    console.log('AI Summarize Debug:', {
      hasApiKey: !!OPENAI_API_KEY,
      keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'none',
      narrativesCount: narratives.length,
      narrativesPreview: narratives.slice(0, 2).map(n => n.substring(0, 50) + '...')
    });

    // Free local option via Ollama if configured (no API key needed)
    if (OLLAMA_BASE_URL) {
      await ensureFetch();
      try {
        const r = await _fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            stream: false,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: `${userPrompt}\n\nWrite 1-3 short paragraphs and 3-5 bullet key results.` }
            ]
          })
        });
        if (!r.ok) {
          const txt = await r.text().catch(()=> '');
          console.log('Ollama error:', r.status, txt);
        } else {
          const j = await r.json().catch(()=> null);
          const content = j?.message?.content || j?.choices?.[0]?.message?.content || '';
          if (content) {
            return res.json({ summary: content, tokens: tokenizeApprox(userPrompt + content), mode: 'ollama' });
          }
        }
      } catch (e) {
        console.log('Ollama request failed:', e.message || String(e));
      }
      // If Ollama fails, fall through to other providers/fallback
    }

    // Fallback when no OpenAI key and no other provider succeeded
    if (!OPENAI_API_KEY && !OPENAI_BASE_URL) {
      console.log('No AI provider configured, using heuristic fallback');
      const joined = narratives.join('\n\n').slice(0, 4000);
      const fake = `Summary (heuristic): ${joined.split(/\n+/).slice(0,3).join(' ')}\n\n- Key Result 1\n- Key Result 2\n- Key Result 3`;
      return res.json({ summary: fake, tokens: tokenizeApprox(userPrompt), mode: 'fallback' });
    }

    await ensureFetch();

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let resp;
    try {
      resp = await _fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          ...(OPENAI_API_KEY ? { 'Authorization': `Bearer ${OPENAI_API_KEY}` } : {}),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `${userPrompt}\n\nWrite 1-3 short paragraphs and 3-5 bullet key results.` }
          ]
        }),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(to);
      console.log('AI Request failed with error:', e.message || String(e));
      // Network or send failure — fallback to heuristic summary instead of failing the request
      const joined = narratives.join('\n\n').slice(0, 4000);
      const fake = `Summary (heuristic): ${joined.split(/\n+/).slice(0,3).join(' ')}\n\n- Key Result 1\n- Key Result 2\n- Key Result 3`;
      return res.json({ summary: fake, tokens: tokenizeApprox(userPrompt), mode: 'fallback_error', detail: e.message || String(e) });
    }
    clearTimeout(to);

    if (!resp.ok) {
      const txt = await resp.text().catch(()=> '');
      console.log('OpenAI API error:', resp.status, txt);
      // API responded with error (e.g., bad/expired key). Fall back to heuristic summary
      const joined = narratives.join('\n\n').slice(0, 4000);
      const fake = `Summary (heuristic): ${joined.split(/\n+/).slice(0,3).join(' ')}\n\n- Key Result 1\n- Key Result 2\n- Key Result 3`;
      return res.json({ summary: fake, tokens: tokenizeApprox(userPrompt), mode: 'fallback_error', status: resp.status, detail: txt });
    }

    const json = await resp.json().catch(() => null);
    const content = json?.choices?.[0]?.message?.content || '';
    const tokens = json?.usage?.total_tokens || tokenizeApprox(userPrompt + content);
    return res.json({ summary: content, tokens, mode: 'openai' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
};


