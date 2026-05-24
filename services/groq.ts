const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqFeedback {
  score: number;
  relevance: number;
  clarity: number;
  depth: number;
  fillerWords: string[];
  fillerCount: number;
  pace: 'too slow' | 'good' | 'too fast';
  wordsPerMinute: number;
  feedback: string;
  improvements: string[];
}

export async function analyzeAnswer(
  question: string,
  transcript: string,
  durationSeconds: number
): Promise<GroqFeedback> {
  const wordCount = transcript.trim().split(/\s+/).length;
  const wpm = Math.round((wordCount / durationSeconds) * 60);
  const pace: GroqFeedback['pace'] =
    wpm < 110 ? 'too slow' : wpm > 160 ? 'too fast' : 'good';

  const fillerPattern =
    /\b(um|uh|like|you know|basically|literally|actually|sort of|kind of|right|okay|so)\b/gi;
  const fillerMatches = transcript.match(fillerPattern) || [];
  const fillerWords = [...new Set(fillerMatches.map((w) => w.toLowerCase()))];

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `You are an expert interview coach. 
Analyze the following interview answer and return ONLY 
a valid JSON object with no extra text, no markdown, 
no code blocks. Just raw JSON.

Return this exact structure:
{
  "score": <number 0-100>,
  "relevance": <number 0-100>,
  "clarity": <number 0-100>,
  "depth": <number 0-100>,
  "feedback": "<2 sentence feedback string>",
  "improvements": ["tip1", "tip2", "tip3"]
}`
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nAnswer: ${transcript}`
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content;

  // Strip any markdown code blocks if present
  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    score: parsed.score ?? 50,
    relevance: parsed.relevance ?? 50,
    clarity: parsed.clarity ?? 50,
    depth: parsed.depth ?? 50,
    feedback: parsed.feedback ?? '',
    improvements: parsed.improvements ?? [],
    fillerWords,
    fillerCount: fillerMatches.length,
    pace,
    wordsPerMinute: wpm,
  };
}