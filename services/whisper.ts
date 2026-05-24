const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_KEY;
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();

  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as any);

  formData.append('model', 'whisper-large-v3');
  formData.append('temperature', '0');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');

  const res = await fetch(GROQ_WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper error: ${err}`);
  }

  const data = await res.json();
  return data.text ?? '';
}