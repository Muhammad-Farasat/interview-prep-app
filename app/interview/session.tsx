import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { transcribeAudio } from '../../services/whisper';
import { analyzeAnswer } from '../../services/groq';
import { generateSpeech } from '../../services/elevenlabs';

type ScreenState = 'generating' | 'speaking' | 'countdown' | 'recording' | 'processing' | 'finished';

interface AnswerRecord {
  question: string;
  transcript: string;
  score: number;
  relevance: number;
  clarity: number;
  depth: number;
  feedback: string;
  improvements: string[];
  fillerCount: number;
  fillerWords: string[];
  pace: string;
  wordsPerMinute: number;
  isFollowUp: boolean;
  parentQuestion?: string;
}

const BAR_COUNT = 20;

function AIWaveform({ active }: { active: boolean }) {
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(4))
  ).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      loopsRef.current.forEach(l => l.stop());
      loopsRef.current = anims.map((anim, index) => {
        const duration = 240 + index * 20;
        const maxHeight = 14 + Math.random() * 26;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: maxHeight,
              duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4 + Math.random() * 10,
              duration,
              useNativeDriver: false,
            }),
          ])
        );
        setTimeout(() => loop.start(), index * 40);
        return loop;
      });
    } else {
      loopsRef.current.forEach(l => l.stop());
      anims.forEach(anim =>
        Animated.timing(anim, {
          toValue: 4,
          duration: 180,
          useNativeDriver: false,
        }).start()
      );
    }

    return () => {
      loopsRef.current.forEach(l => l.stop());
    };
  }, [active, anims]);

  return (
    <View style={waveStyles.row}>
      {anims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            waveStyles.bar,
            {
              height: anim,
              backgroundColor: active ? '#52B788' : 'rgba(255,255,255,0.15)',
            },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginVertical: 18,
  },
  bar: {
    width: 5,
    borderRadius: 3,
    marginHorizontal: 2,
  },
});

const generateQuestions = async (field: string, difficulty: string, count: number) => {
  const prompt = `Generate exactly ${count} interview questions for a ${field} role at ${difficulty} difficulty level.
Return ONLY a JSON array of strings. No numbering, no explanation, no markdown. Example: ["Question 1", "Question 2"]`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  return JSON.parse(content) as string[];
};

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ field?: string; totalQuestions?: string; difficulty?: string }>();

  const field = params.field || 'general';
  const difficulty = params.difficulty || 'medium';
  const totalQuestions = parseInt(params.totalQuestions || '5', 10);

  const [screenState, setScreenState] = useState<ScreenState>('generating');
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [currentMainQuestion, setCurrentMainQuestion] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<AnswerRecord[]>([]);
  const questionsRef = useRef<string[]>([]);
  const isMutedRef = useRef(false);
  const isFollowUpRef = useRef(false);
  const followUpCountRef = useRef(0);
  const currentMainQuestionRef = useRef('');
  const currentIdxRef = useRef(0);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    isFollowUpRef.current = isFollowUp;
  }, [isFollowUp]);
  useEffect(() => {
    followUpCountRef.current = followUpCount;
  }, [followUpCount]);
  useEffect(() => {
    currentMainQuestionRef.current = currentMainQuestion;
  }, [currentMainQuestion]);
  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  const countdownScale = useRef(new Animated.Value(1)).current;

  const pulseCountdown = () => {
    countdownScale.setValue(1.3);
    Animated.spring(countdownScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const micPulse = useRef(new Animated.Value(1)).current;
  const micPulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (screenState === 'recording') {
      micPulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      micPulseLoop.current.start();
    } else {
      micPulseLoop.current?.stop();
      micPulse.setValue(1);
    }
  }, [screenState, micPulse]);

  useEffect(() => {
    (async () => {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record your answer.');
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    })();

    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recordingRef.current?.stopAndUnloadAsync();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadQuestions = async () => {
      setScreenState('generating');
      try {
        const generated = await generateQuestions(field, difficulty, totalQuestions);
        if (cancelled) return;
        if (!Array.isArray(generated) || generated.length === 0) {
          throw new Error('Groq returned no questions');
        }

        const selected = generated.slice(0, totalQuestions);
        setQuestions(selected);
        questionsRef.current = selected;
        startQuestion(0, selected);
      } catch (err) {
        console.error('Question generation error:', err);
        if (cancelled) return;
        Alert.alert(
          'Question Generation Failed',
          'Could not prepare your questions. Please try again.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    };

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleBack = () => {
    Alert.alert('End interview?', 'All progress will be lost.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  const startCountdown = useCallback(() => {
    setScreenState('countdown');
    setCountdown(3);
    pulseCountdown();

    let count = 3;
    const tick = () => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        pulseCountdown();
        setTimeout(tick, 1000);
      } else {
        startRecording();
      }
    };
    setTimeout(tick, 1000);
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (isMutedRef.current) {
      startCountdown();
      return;
    }
    try {
      setScreenState('speaking');
      const fileUri = await generateSpeech(text);
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          startCountdown();
        }
      });
    } catch (err) {
      console.error('TTS error:', err);
      startCountdown();
    }
  }, [startCountdown]);

  const generateFollowUp = async (question: string, transcript: string, score: number): Promise<string | null> => {
    try {
      let allowedFollowUps = 0;
      if (score < 50) allowedFollowUps = 2;
      else if (score < 75) allowedFollowUps = 1;

      if (followUpCountRef.current >= allowedFollowUps) return null;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 150,
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `You are a technical interviewer. Based on the candidate's answer, generate ONE sharp follow-up question that digs deeper into a weak or missing point in their answer. Rules: Maximum 2 sentences, be specific to what they said, challenge them on something they glossed over, sound like a real interviewer, return ONLY the question.`,
            },
            {
              role: 'user',
              content: `Original question: ${question}\nCandidate answer: ${transcript}\nScore: ${score}/100\nGenerate a probing follow-up question.`,
            },
          ],
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      console.error('Follow-up generation error:', err);
      return null;
    }
  };

  const startQuestion = (index: number, qs?: string[]) => {
    const questionList = qs ?? questionsRef.current;
    setCurrentIdx(index);
    setScreenState('speaking');
    speakText(questionList[index]);
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, 120_000);

      setScreenState('recording');
    } catch (err) {
      console.error(err);
      Alert.alert('Recording Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
        autoStopRef.current = null;
      }

      setScreenState('processing');

      if (!recordingRef.current) throw new Error('No active recording');

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('Recording URI is null');

      const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
      const transcript = await transcribeAudio(uri);
      await processAnswer(transcript, durationSeconds);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Processing Error', err?.message ?? 'Something went wrong. Please try again.');
      setScreenState('recording');
    }
  };

  const processAnswer = async (transcript: string, durationSeconds: number) => {
    try {
      const idx = currentIdxRef.current;
      const question = questionsRef.current[idx];
      const feedbackObj = await analyzeAnswer(question, transcript, durationSeconds);

      const record: AnswerRecord = {
        question,
        transcript,
        score: feedbackObj.score,
        relevance: feedbackObj.relevance,
        clarity: feedbackObj.clarity,
        depth: feedbackObj.depth,
        feedback: feedbackObj.feedback,
        improvements: feedbackObj.improvements,
        fillerCount: feedbackObj.fillerCount,
        fillerWords: feedbackObj.fillerWords,
        pace: feedbackObj.pace,
        wordsPerMinute: feedbackObj.wordsPerMinute,
        isFollowUp: isFollowUpRef.current,
        parentQuestion: isFollowUpRef.current ? currentMainQuestionRef.current : undefined,
      };

      const updatedAnswers = [...answersRef.current, record];
      setAnswers(updatedAnswers);
      answersRef.current = updatedAnswers;

      const followUpQuestion = await generateFollowUp(question, transcript, feedbackObj.score);

      if (followUpQuestion) {
        const nextIdx = idx + 1;
        const newFollowUpCount = followUpCountRef.current + 1;
        setFollowUpCount(newFollowUpCount);
        followUpCountRef.current = newFollowUpCount;

        if (!isFollowUpRef.current) {
          setCurrentMainQuestion(question);
          currentMainQuestionRef.current = question;
        }
        setIsFollowUp(true);
        isFollowUpRef.current = true;

        const newQuestions = [...questionsRef.current];
        newQuestions.splice(nextIdx, 0, followUpQuestion);
        setQuestions(newQuestions);
        questionsRef.current = newQuestions;

        setCurrentIdx(nextIdx);
        currentIdxRef.current = nextIdx;
        await speakText(followUpQuestion);
      } else {
        setIsFollowUp(false);
        isFollowUpRef.current = false;
        setFollowUpCount(0);
        followUpCountRef.current = 0;
        setCurrentMainQuestion('');
        currentMainQuestionRef.current = '';

        const nextIdx = idx + 1;
        if (nextIdx >= questionsRef.current.length) {
          setScreenState('finished');
          navigateToResults(updatedAnswers);
        } else {
          setCurrentIdx(nextIdx);
          currentIdxRef.current = nextIdx;
          await speakText(questionsRef.current[nextIdx]);
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Processing Error', err?.message ?? 'Something went wrong. Please try again.');
      setScreenState('recording');
    }
  };

  const navigateToResults = (finalAnswers: AnswerRecord[]) => {
    router.replace({
      pathname: '/interview/results',
      params: {
        field,
        totalQuestions: String(finalAnswers.length),
        questionsJson: JSON.stringify(questionsRef.current),
        answersJson: JSON.stringify(finalAnswers),
      },
    });
  };

  const currentQuestion = questions[currentIdx] ?? '';
  const isGenerating = screenState === 'generating';

  const renderMiddle = () => {
    if (screenState === 'generating') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#52B788" />
          <Text style={styles.subtleLabel}>Preparing your questions...</Text>
        </View>
      );
    }

    if (screenState === 'speaking') {
      return (
        <View style={styles.centeredSection}>
          <Text style={[styles.interviewerLabel, isFollowUp && styles.followUpLabel]}>
            {isFollowUp ? 'Follow-up question' : 'Interviewer'}
          </Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <AIWaveform active />
          <Text style={styles.questionText}>{currentQuestion}</Text>
        </View>
      );
    }

    if (screenState === 'countdown') {
      return (
        <View style={styles.centeredSection}>
          <Text style={[styles.interviewerLabel, isFollowUp && styles.followUpLabel]}>
            {isFollowUp ? 'Follow-up question' : 'Your turn'}
          </Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <AIWaveform active={false} />
          <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}>
            {countdown}
          </Animated.Text>
          <Text style={styles.subtleLabel}>Answer in your own words</Text>
          <Text style={styles.questionTextSmall}>{currentQuestion}</Text>
        </View>
      );
    }

    if (screenState === 'recording') {
      return (
        <View style={styles.centeredSection}>
          <Text style={styles.questionTextSmall}>{currentQuestion}</Text>
          <View style={styles.recordingArea}>
            <Animated.View style={{ transform: [{ scale: micPulse }] }}>
              <TouchableOpacity style={styles.bigMicButton} onPress={stopRecording} activeOpacity={0.85}>
                <View style={styles.bigMicInner} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.recordingTimer}>{formatTime(recordingTime)}</Text>
            <Text style={styles.subtleLabel}>Recording your answer</Text>
            <Text style={styles.tapToStopHint}>Tap the red button to stop</Text>
          </View>
        </View>
      );
    }

    if (screenState === 'processing') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#52B788" />
          <Text style={styles.subtleLabel}>Analyzing your response</Text>
        </View>
      );
    }

    if (screenState === 'finished') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#52B788" />
          <Text style={styles.subtleLabel}>Wrapping up results</Text>
        </View>
      );
    }

    return null;
  };

  const renderDots = () => {
    if (isGenerating || questions.length === 0) return null;
    const dotCount = Math.max(questions.length, totalQuestions);
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: dotCount }).map((_, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isCurrent && styles.dotCurrent,
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070A0B" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBack} activeOpacity={0.85}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          {isGenerating
            ? 'Preparing your questions'
            : isFollowUp
              ? `Follow-up ${followUpCount}`
              : `Question ${currentIdx + 1} of ${totalQuestions}`}
        </Text>

        <TouchableOpacity style={styles.iconButton} onPress={() => setIsMuted(prev => !prev)} activeOpacity={0.85}>
          <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.middle}>{renderMiddle()}</View>
      <View style={styles.bottomArea}>{renderDots()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A0B',
  },
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0D0F',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C1E',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    marginHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  centeredSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  interviewerLabel: {
    color: '#52B788',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  followUpLabel: {
    color: '#FF9800',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#D8F3E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(82,183,136,0.22)',
  },
  avatarText: {
    color: '#2D6A4F',
    fontSize: 28,
    fontWeight: '800',
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  questionTextSmall: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
  subtleLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 76,
    lineHeight: 86,
    fontWeight: '800',
    textAlign: 'center',
  },
  recordingArea: {
    marginTop: 34,
    alignItems: 'center',
  },
  bigMicButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  bigMicInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  recordingTimer: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 24,
  },
  tapToStopHint: {
    color: '#FF9F0A',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  bottomArea: {
    minHeight: 72,
    paddingHorizontal: 24,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2C2C2E',
  },
  dotCompleted: {
    backgroundColor: '#52B788',
  },
  dotCurrent: {
    width: 22,
    backgroundColor: '#FFFFFF',
  },
});
