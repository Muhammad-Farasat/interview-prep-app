import { File, Paths } from 'expo-file-system';

const ELEVENLABS_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_KEY;
const ELEVENLABS_VOICE_ID = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID;

export const generateSpeech = async (text: string): Promise<string> => {
  console.log('Calling ElevenLabs with key:', ELEVENLABS_KEY.substring(0, 10) + '...');

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  console.log('ElevenLabs response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs error body:', errorText);
    throw new Error(`ElevenLabs error: ${response.status} - ${errorText}`);
  }

  // Write audio bytes directly to cache using the new expo-file-system v55 API
  const audioBuffer = await response.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);

  const file = new File(Paths.cache, 'tts_audio.mp3');
  file.write(audioBytes);

  return file.uri;
};
