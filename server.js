import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Gemini API key is not configured yet. Please check Settings > Secrets to set GEMINI_API_KEY.');
    err.statusCode = 500;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiErrorMessage(err) {
  const raw = err?.message || 'Unable to generate AI team rating right now.';
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) return parsed.error.message;
  } catch (_) {}
  return raw;
}

async function generateRosterEvaluationWithRetry(ai, promptText, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: 'You are an expert NFL General Manager and Pro Football Hall of Fame scouting analyst. Provide crisp, enthusiastic, grounded NFL roster evaluations referencing the exact players drafted — especially highlighting the Offensive Line trenches alongside QB, weapons, defense, and special teams.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scoreOutOf10: {
                type: Type.NUMBER,
                description: 'Overall team rating out of 10 (e.g. 9.2).',
              },
              grade: {
                type: Type.STRING,
                description: 'Letter grade like A+, A, A-, B+, B.',
              },
              headline: {
                type: Type.STRING,
                description: 'Short catchy scouting headline summarizing the team identity.',
              },
              offenseRating: {
                type: Type.NUMBER,
                description: 'QB and skill offense score out of 10.',
              },
              oLineRating: {
                type: Type.NUMBER,
                description: '5-man Offensive Line trench unit score out of 10.',
              },
              defenseRating: {
                type: Type.NUMBER,
                description: '9-man Defensive unit score out of 10.',
              },
              specialTeamsRating: {
                type: Type.NUMBER,
                description: 'Special teams unit score out of 10.',
              },
              mvpPick: {
                type: Type.STRING,
                description: 'The single standout MVP player on this roster and why in one short phrase.',
              },
              strengths: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Three concise bullet strengths referencing specific drafted players.',
              },
              improvements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Two concise coaching tweaks or areas to watch out for.',
              },
              championshipOutlook: {
                type: Type.STRING,
                description: 'Projected NFL record and playoff ceiling (e.g. 14-3 · Super Bowl Champion Favorite).',
              },
            },
            required: [
              'scoreOutOf10',
              'grade',
              'headline',
              'offenseRating',
              'oLineRating',
              'defenseRating',
              'specialTeamsRating',
              'mvpPick',
              'strengths',
              'improvements',
              'championshipOutlook',
            ],
          },
        },
      });
    } catch (err) {
      lastErr = err;
      const status = err?.statusCode || err?.status || 0;
      const isTransient = status === 503 || status === 429 || /503|429|UNAVAILABLE|high demand/i.test(err?.message || '');
      if (!isTransient || attempt === maxAttempts) throw err;
      await new Promise(resolve => setTimeout(resolve, 900 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

app.post('/api/rate-roster', async (req, res) => {
  try {
    const { teamName, notes, players } = req.body || {};
    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: 'Please select players on your roster before requesting an AI rating.' });
    }

    const ai = getGeminiClient();
    const lineupSummary = players
      .map(p => `- ${p.slot}: ${p.name} (${p.position}, ${p.team}, OVR ${p.rating}, ${p.touchdowns} TDs, ${p.blocks} Blocks)`)
      .join('\n');

    const promptText = `Evaluate this custom 23-player NFL franchise roster and rate it honestly out of 10.
Team Name: ${teamName || 'My Custom NFL Team'}
Coach Strategy Notes: ${notes || 'Balanced championship roster'}

Selected 23-Man Lineup:
${lineupSummary}

Rate the overall team out of 10 (scoreOutOf10 with one decimal place like 8.8 or 9.4), give unit scores out of 10 for offenseRating, oLineRating, defenseRating, and specialTeamsRating, assign a letter grade (e.g. A+, A, A-, B+, B), pick the team's MVP (mvpPick), list 3 specific strengths referencing actual players on the roster, list 2 areas to improve or watch out for, and project their season record & playoff outlook (championshipOutlook).`;

    const response = await generateRosterEvaluationWithRetry(ai, promptText, 3);
    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    return res.json({ rating: parsed });
  } catch (err) {
    console.error('AI roster rating error:', err);
    const status = err?.statusCode || err?.status || 500;
    const msg = parseGeminiErrorMessage(err);
    return res.status(status).json({ error: msg });
  }
});

// Serve static assets from root and public
app.use(express.static(__dirname));
if (path.join(__dirname, 'public')) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Fallback to index.html for all requests
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Football Passion server listening on http://0.0.0.0:${PORT}`);
});

