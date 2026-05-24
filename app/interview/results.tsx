import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { saveSession } from '../../services/supabase';

interface AnswerRecord {
  question: string;
  transcript: string;
  score: number;
  relevance: number;
  clarity: number;
  depth: number;
  feedback: string;
  fillerCount: number;
  fillerWords: string[];
  pace: string;
  wordsPerMinute: number;
  improvements?: string[];
}

export default function ResultsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { userId } = useAuth();

  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [avgScore, setAvgScore] = useState<number>(0);
  const [avgClarity, setAvgClarity] = useState<number>(0);
  const [avgDepth, setAvgDepth] = useState<number>(0);
  const [displayScore, setDisplayScore] = useState<number>(0);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const scoreAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      const rawAnswers = params.answersJson;
      const rawQuestions = params.questionsJson;

      console.log('RAW ANSWERS TYPE:', typeof rawAnswers);
      console.log('RAW ANSWERS:', typeof rawAnswers === 'string' ? rawAnswers.substring(0, 100) : JSON.stringify(rawAnswers).substring(0, 100));

      let answersString = '';
      let questionsString = '';

      if (Array.isArray(rawAnswers)) {
        answersString = rawAnswers.join('');
      } else if (typeof rawAnswers === 'string') {
        answersString = rawAnswers;
      }

      if (Array.isArray(rawQuestions)) {
        questionsString = rawQuestions.join('');
      } else if (typeof rawQuestions === 'string') {
        questionsString = rawQuestions;
      }

      const parsedAnswers = JSON.parse(answersString);
      const parsedQuestions = JSON.parse(questionsString);

      console.log('PARSED ANSWERS COUNT:', parsedAnswers.length);

      setAnswers(Array.isArray(parsedAnswers) ? parsedAnswers : []);
      setQuestions(Array.isArray(parsedQuestions) ? parsedQuestions : []);
      setIsReady(true);
    } catch (e) {
      console.error('Results parse error:', e);
      console.error('answersJson value:', params.answersJson);
      setIsReady(false);
    }
  }, []);

  // Compute averages and animate score once answers are loaded
  useEffect(() => {
    if (answers.length === 0) return;

    const calcAvgScore = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.score ?? 0), 0) / answers.length)
      : 0;
    const calcAvgClarity = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.clarity ?? 0), 0) / answers.length)
      : 0;
    const calcAvgDepth = answers.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.depth ?? 0), 0) / answers.length)
      : 0;

    setAvgScore(calcAvgScore);
    setAvgClarity(calcAvgClarity);
    setAvgDepth(calcAvgDepth);

    const allImprovements = answers.flatMap(a => a.improvements ?? []).filter(Boolean);
    const topImprovements = [...new Set(allImprovements)].slice(0, 3);
    setImprovements(topImprovements);

    // Animate score counter
    scoreAnim.setValue(0);
    const listenerId = scoreAnim.addListener(({ value }) => {
      setDisplayScore(Math.floor(value));
    });

    Animated.timing(scoreAnim, {
      toValue: calcAvgScore,
      duration: 1200,
      useNativeDriver: false,
    }).start();

    return () => {
      scoreAnim.removeListener(listenerId);
    };
  }, [answers]);

  // Save session to Supabase once results are ready
  useEffect(() => {
    if (!isReady || answers.length === 0 || saved) return;

    const save = async () => {
      try {
        if (!userId) return;

        const calcAvgScore = Math.round(
          answers.reduce((sum, a) => sum + (a.score ?? 0), 0) / answers.length
        );
        const calcAvgClarity = Math.round(
          answers.reduce((sum, a) => sum + (a.clarity ?? 0), 0) / answers.length
        );
        const calcAvgDepth = Math.round(
          answers.reduce((sum, a) => sum + (a.depth ?? 0), 0) / answers.length
        );

        await saveSession({
          user_id: userId,
          field: Array.isArray(params.field) ? params.field[0] : params.field ?? 'general',
          total_questions: answers.length,
          avg_score: calcAvgScore,
          avg_clarity: calcAvgClarity,
          avg_depth: calcAvgDepth,
          answers: answers,
          questions: questions,
        });

        setSaved(true);
        console.log('Session saved to Supabase');
      } catch (err) {
        console.error('Failed to save session:', err);
      }
    };

    save();
  }, [isReady, answers, saved]);



  const getColor = (score: number) => {
    if (score >= 75) return '#4CAF50'; // green
    if (score >= 50) return '#FF9800'; // amber
    return '#F44336'; // red
  };

  const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  if (!isReady || answers.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000',
        justifyContent: 'center', alignItems: 'center',
        padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>
          Loading results...
        </Text>
        <Text style={{ color: '#555', fontSize: 11,
          textAlign: 'center' }}>
          answers: {params.answersJson ? 'received' : 'missing'}{'\n'}
          questions: {params.questionsJson ? 'received' : 'missing'}{'\n'}
          isReady: {String(isReady)}{'\n'}
          count: {answers.length}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Session Complete 🎯</Text>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        
        {/* 2. OVERALL SCORE CARD */}
        <View style={styles.scoreCard}>
          <Text style={[styles.bigScore, { color: getColor(avgScore) }]}>
            {displayScore}
          </Text>
          <Text style={styles.scoreLabel}>Overall Score</Text>
          
          <View style={styles.fieldBadge}>
            <Text style={styles.fieldBadgeText}>
              {capitalize(params.field || 'General')}
            </Text>
          </View>
        </View>

        {/* 3. STATS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statMiniCard}>
            <Text style={styles.statValue}>{params.totalQuestions || answers.length}</Text>
            <Text style={styles.statLabelMini}>Questions</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statValue}>{avgClarity}</Text>
            <Text style={styles.statLabelMini}>Avg Clarity</Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text style={styles.statValue}>{avgDepth}</Text>
            <Text style={styles.statLabelMini}>Avg Depth</Text>
          </View>
        </View>

        {/* 4. PER QUESTION BREAKDOWN */}
        <Text style={styles.sectionTitle}>Question Breakdown</Text>
        {answers.map((ans, idx) => (
          <View key={idx} style={styles.questionCard}>
            
            {/* Top row */}
            <View style={styles.questionCardHeader}>
              <Text style={styles.qIndex}>Q{idx + 1}</Text>
              <View style={[styles.qScorePill, { backgroundColor: getColor(ans.score) }]}>
                <Text style={styles.qScoreText}>{ans.score}</Text>
              </View>
            </View>

            {/* Question Text */}
            <Text style={styles.questionText} numberOfLines={2}>
              {ans.question}
            </Text>

            {/* Three Progress Bars */}
            <View style={styles.progressSection}>
              <MetricBar label="Relevance" value={ans.relevance} color={getColor(ans.relevance)} />
              <MetricBar label="Clarity" value={ans.clarity} color={getColor(ans.clarity)} />
              <MetricBar label="Depth" value={ans.depth} color={getColor(ans.depth)} />
            </View>

            {/* Feedback text */}
            <Text style={styles.feedbackText}>
              "{ans.feedback}"
            </Text>

            {/* Filler words line */}
            <Text style={styles.fillerText}>
              💬 {ans.fillerCount} filler words
            </Text>

          </View>
        ))}

        {/* 5. TOP IMPROVEMENTS */}
        {improvements.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Focus On These 🎯</Text>
            {improvements.map((imp, idx) => (
              <View key={idx} style={styles.improvementCard}>
                <Text style={styles.improvementText}>{imp}</Text>
              </View>
            ))}
          </>
        )}

        {/* 6. FOOTER BUTTONS */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Practice Again</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)/history')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>View History</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
}

function MetricBar({ label, value, color }: MetricBarProps) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.barContainer}>
        <View style={[styles.barFiller, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    height: 56,
    backgroundColor: '#0D0D0F',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C1E',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    margin: 16,
    alignItems: 'center',
  },
  bigScore: {
    fontSize: 72,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scoreLabel: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
  },
  fieldBadge: {
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  fieldBadgeText: {
    color: '#7F77DD',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  statMiniCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabelMini: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 16,
    marginHorizontal: 16,
    fontWeight: 'bold',
  },
  questionCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qIndex: {
    color: '#7F77DD',
    fontSize: 11,
    fontWeight: 'bold',
  },
  qScorePill: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  qScoreText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 14,
  },
  progressSection: {
    gap: 8,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#8E8E93',
    fontSize: 12,
    width: 70,
  },
  barContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#2C2C2E',
    borderRadius: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  barFiller: {
    height: '100%',
    borderRadius: 2,
  },
  metricValue: {
    color: '#8E8E93',
    fontSize: 12,
    width: 30,
    textAlign: 'right',
    fontWeight: '600',
  },
  feedbackText: {
    color: '#8E8E93',
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    marginTop: 2,
  },
  fillerText: {
    color: '#55555A',
    fontSize: 12,
    fontWeight: '500',
  },
  improvementCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#7F77DD',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 14,
    paddingLeft: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  improvementText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    margin: 16,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#7F77DD',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7F77DD',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#7F77DD',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
