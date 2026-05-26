import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { transcribeAudio } from '../../services/whisper';
import { analyzeAnswer } from '../../services/groq';
import { generateSpeech } from '../../services/elevenlabs';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Waveform component ───────────────────────────────────────────────────────

const BAR_COUNT = 20;

function AIWaveform({ active }: { active: boolean }) {
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(4))
  ).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (active) {
      loopsRef.current.forEach(l => l.stop());
      loopsRef.current = anims.map((anim, i) => {
        const duration = 300 + Math.random() * 300;
        const maxHeight = 12 + Math.random() * 28;
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: maxHeight,
              duration,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4 + Math.random() * 8,
              duration,
              useNativeDriver: false,
            }),
          ])
        );
        // Stagger start
        setTimeout(() => loop.start(), i * 30);
        return loop;
      });
    } else {
      loopsRef.current.forEach(l => l.stop());
      anims.forEach(anim =>
        Animated.timing(anim, { toValue: 4, duration: 200, useNativeDriver: false }).start()
      );
    }

    return () => {
      loopsRef.current.forEach(l => l.stop());
    };
  }, [active]);

  return (
    <View style={waveStyles.row}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            {
              height: anim,
              backgroundColor: active ? '#7F77DD' : '#2C2C2E',
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
    height: 48,
    marginVertical: 16,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ field?: string; totalQuestions?: string }>();

  const field = params.field || 'general';
  const totalQuestions = parseInt(params.totalQuestions || '5', 10);

  // ── State ──────────────────────────────────────────────────────────────────
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

  // ── Refs ───────────────────────────────────────────────────────────────────
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

  // Keep refs in sync so callbacks always see latest values
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isFollowUpRef.current = isFollowUp; }, [isFollowUp]);
  useEffect(() => { followUpCountRef.current = followUpCount; }, [followUpCount]);
  useEffect(() => { currentMainQuestionRef.current = currentMainQuestion; }, [currentMainQuestion]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // ── Countdown animation ────────────────────────────────────────────────────
  const countdownScale = useRef(new Animated.Value(1)).current;

  const pulseCountdown = () => {
    countdownScale.setValue(1.3);
    Animated.spring(countdownScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  // ── Mic pulse animation ────────────────────────────────────────────────────
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
  }, [screenState]);

  // ── Permissions + audio mode on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record your answers.');
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

  // ── Generate questions on mount ────────────────────────────────────────────
  useEffect(() => {
    generateQuestions();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleBack = () => {
    Alert.alert('End interview?', 'All progress will be lost.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes', onPress: () => {
          router.replace('/(tabs)');
        }
      },
    ]);
  };

  // ── Speech ─────────────────────────────────────────────────────────────────

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
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          startCountdown();
        }
      });
    } catch (err) {
      console.error('TTS error:', err);
      // Fallback: skip speech and go straight to countdown
      startCountdown();
    }
  }, [startCountdown]);

  // ── Question generation ────────────────────────────────────────────────────

  const generateFollowUp = async (
    question: string,
    transcript: string,
    score: number
  ): Promise<string | null> => {
    try {
      // Determine allowed follow-ups based on score
      let allowedFollowUps = 0;
      if (score < 50) allowedFollowUps = 2;
      else if (score < 75) allowedFollowUps = 1;
      else allowedFollowUps = 0;

      // Already hit the limit for this question
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
              content: `You are a technical interviewer. Based on the candidate's answer, generate ONE sharp follow-up question that digs deeper into a weak or missing point in their answer.\nRules:\n- Maximum 2 sentences\n- Be specific to what they said\n- Challenge them on something they glossed over\n- Sound like a real interviewer\n- Return ONLY the question, nothing else`,
            },
            {
              role: 'user',
              content: `Original question: ${question}\nCandidate answer: ${transcript}\nScore: ${score}/100\nGenerate a follow-up question that probes the weakest part of their answer.`,
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

  const generateQuestions = async () => {
    setScreenState('generating');
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: `You are a technical interviewer. Generate exactly ${totalQuestions} interview questions for a ${field} developer role. Return ONLY a valid JSON array of strings. No markdown, no numbering.`,
            },
            { role: 'user', content: `Generate ${totalQuestions} questions for ${field}` },
          ],
        }),
      });

      if (!res.ok) throw new Error(`Groq API error: ${res.status}`);

      const data = await res.json();
      const raw = data.choices[0].message.content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed: string[] = JSON.parse(raw);
      if (!parsed.length) throw new Error('Empty questions array');

      setQuestions(parsed);
      questionsRef.current = parsed;
      startQuestion(0, parsed);
    } catch (err) {
      console.warn('Falling back to offline questions:', err);
      const fallbacks: Record<string, string[]> = {
        frontend: [
          'What is the CSS box model and how does it work?',
          'Explain how the virtual DOM works in React.',
          'What are the differences between controlled and uncontrolled components?',
          'How would you optimize a React app that renders 10,000 list items?',
          'What is event delegation and why is it useful?',
        ],
        backend: [
          'What is a REST API and how does it work?',
          'Explain database indexing and when you would use it.',
          'What are the key differences between SQL and NoSQL databases?',
          'How does authentication work with JWT?',
          'How would you design a rate limiting system for a public API?',
        ],
        mobile: [
          'What is the difference between React Native and native development?',
          'Explain how navigation works in React Native apps.',
          'What are the performance best practices in React Native?',
          'How would you handle offline support in a React Native app?',
          'What is the difference between a FlatList and a ScrollView?',
        ],
        general: [
          'Tell me about yourself and your experience as a developer.',
          'What is your biggest strength as a developer?',
          'Describe a challenging bug you faced and how you solved it.',
          'How do you handle tight deadlines and pressure?',
          'Where do you see yourself in 5 years?',
        ],
      };
      const selected = (fallbacks[field.toLowerCase()] || fallbacks.general).slice(0, totalQuestions);
      setQuestions(selected);
      questionsRef.current = selected;
      startQuestion(0, selected);
    }
  };

  // ── Interview flow ─────────────────────────────────────────────────────────

  const startQuestion = (index: number, qs?: string[]) => {
    const questionList = qs ?? questionsRef.current;
    setCurrentIdx(index);
    setScreenState('speaking');
    speakText(questionList[index]);
  };

  // ── Recording ──────────────────────────────────────────────────────────────

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

      // Auto-stop after 120 seconds
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
      Alert.alert('Processing Error', err.message ?? 'Something went wrong. Please try again.');
      setScreenState('recording');
    }
  };

  // ── Answer processing ──────────────────────────────────────────────────────

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

      // Try to generate a follow-up question
      const followUpQuestion = await generateFollowUp(question, transcript, feedbackObj.score);

      if (followUpQuestion) {
        // Track follow-up state
        const newFollowUpCount = followUpCountRef.current + 1;
        setFollowUpCount(newFollowUpCount);
        followUpCountRef.current = newFollowUpCount;

        // Save the main question if this is the first follow-up
        if (!isFollowUpRef.current) {
          setCurrentMainQuestion(question);
          currentMainQuestionRef.current = question;
        }
        setIsFollowUp(true);
        isFollowUpRef.current = true;

        // Insert follow-up right after current position
        const newQuestions = [...questionsRef.current];
        newQuestions.splice(idx + 1, 0, followUpQuestion);
        setQuestions(newQuestions);
        questionsRef.current = newQuestions;

        // Move to the follow-up question
        const nextIdx = idx + 1;
        setCurrentIdx(nextIdx);
        currentIdxRef.current = nextIdx;
        await speakText(followUpQuestion);
      } else {
        // No follow-up — reset follow-up state and advance to next main question
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
      Alert.alert('Processing Error', err.message ?? 'Something went wrong. Please try again.');
      setScreenState('recording');
    }
  };

  // ── Navigate to results ────────────────────────────────────────────────────

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

  // ── Render helpers ─────────────────────────────────────────────────────────

  const currentQuestion = questions[currentIdx] ?? '';
  const isGenerating = screenState === 'generating';

  const renderMiddle = () => {
    if (screenState === 'generating') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#7F77DD" />
          <Text style={styles.subtleLabel}>Preparing your interview...</Text>
        </View>
      );
    }

    if (screenState === 'speaking') {
      return (
        <View style={styles.centeredSection}>
          <Text style={[styles.interviewerLabel, isFollowUp && styles.followUpLabel]}>
            {isFollowUp ? 'Follow-up' : 'Interviewer'}
          </Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <AIWaveform active={true} />
          <Text style={styles.questionText}>{currentQuestion}</Text>
        </View>
      );
    }

    if (screenState === 'countdown') {
      return (
        <View style={styles.centeredSection}>
          <Text style={[styles.interviewerLabel, isFollowUp && styles.followUpLabel]}>
            {isFollowUp ? 'Follow-up' : 'Interviewer'}
          </Text>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <AIWaveform active={false} />
          <Animated.Text
            style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}
          >
            {countdown}
          </Animated.Text>
          <Text style={styles.subtleLabel}>Get ready to answer...</Text>
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
            <Text style={styles.tapToStopHint}>Tap to stop</Text>
          </View>
        </View>
      );
    }

    if (screenState === 'processing') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#7F77DD" />
          <Text style={styles.subtleLabel}>Analyzing...</Text>
        </View>
      );
    }

    if (screenState === 'finished') {
      return (
        <View style={styles.centeredSection}>
          <ActivityIndicator size="large" color="#7F77DD" />
          <Text style={styles.subtleLabel}>Loading results...</Text>
        </View>
      );
    }

    return null;
  };

  // ── Progress dots ──────────────────────────────────────────────────────────

  const renderDots = () => {
    if (isGenerating || questions.length === 0) return null;
    // Only show dots for the original totalQuestions count to keep it clean
    const dotCount = Math.max(questions.length, totalQuestions);
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: dotCount }).map((_, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          // Follow-up questions are inserted after their parent — mark them amber
          const isFollowUpDot = i < questions.length && i > 0 &&
            answersRef.current[i - 1]?.isFollowUp === false &&
            answersRef.current[i]?.isFollowUp === true;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isCompleted && isFollowUpDot && styles.dotFollowUp,
                isCurrent && styles.dotCurrent,
                isCurrent && isFollowUp && styles.dotCurrentFollowUp,
              ]}
            />
          );
        })}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>
          {isGenerating
            ? 'Setting up'
            : isFollowUp
              ? `Follow-up ${followUpCount}`
              : `Question ${currentIdx + 1} of ${totalQuestions}`}
        </Text>

        <TouchableOpacity
          style={styles.muteButton}
          onPress={() => setIsMuted(prev => !prev)}
        >
          <Text style={styles.muteEmoji}>{isMuted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
      </View>

      {/* MIDDLE */}
      <View style={styles.middle}>
        {renderMiddle()}
      </View>

      {/* PROGRESS DOTS */}
      <View style={styles.bottomArea}>
        {renderDots()}
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0F',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C1E',
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  muteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteEmoji: {
    fontSize: 18,
  },

  // Middle section
  middle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },

  // AI avatar
  interviewerLabel: {
    color: '#8E8E93',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7F77DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },

  // Question text
  questionText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 8,
  },
  questionTextSmall: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  // Countdown
  countdownNumber: {
    color: '#7F77DD',
    fontSize: 96,
    fontWeight: 'bold',
    marginVertical: 8,
  },

  // Recording
  recordingArea: {
    alignItems: 'center',
  },
  bigMicButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#A32D2D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  bigMicInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
  },
  recordingTimer: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  tapToStopHint: {
    color: '#555',
    fontSize: 12,
    marginTop: 4,
  },

  // Subtle label
  subtleLabel: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },

  // Progress dots
  bottomArea: {
    paddingBottom: 32,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2C2C2E',
  },
  dotCompleted: {
    backgroundColor: '#7F77DD',
  },
  dotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  dotFollowUp: {
    backgroundColor: '#FF9800',
  },
  dotCurrentFollowUp: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9800',
  },
  followUpLabel: {
    color: '#FF9800',
  },
});
