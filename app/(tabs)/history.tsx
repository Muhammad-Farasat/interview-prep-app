import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { getUserSessions, SessionRecord } from '../../services/supabase';
import { useRouter } from 'expo-router';

const COLORS = {
  background: '#F7F7F5',
  card: '#FFFFFF',
  border: '#EBEBEB',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textHint: '#ABABAB',
  mint: '#52B788',
  mintLight: '#D8F3E8',
  mintDark: '#2D6A4F',
};

function getScoreColors(score: number) {
  if (score >= 75) {
    return { text: COLORS.mintDark, background: COLORS.mintLight };
  }
  if (score >= 50) {
    return { text: '#E65100', background: '#FFF3E0' };
  }
  return { text: '#B71C1C', background: '#FFEBEE' };
}

function formatDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatField(field: string) {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

export default function HistoryScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await getUserSessions(userId);
      setSessions(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSessions();
  };

  const renderSession = ({ item }: { item: SessionRecord }) => {
    const scoreColors = getScoreColors(item.avg_score);
    const questions = item.questions ?? [];

    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.fieldName}>{formatField(item.field)}</Text>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={[styles.scoreCircle, { backgroundColor: scoreColors.background }]}>
            <Text style={[styles.scoreText, { color: scoreColors.text }]}>
              {item.avg_score}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.total_questions}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.avg_clarity}</Text>
            <Text style={styles.statLabel}>Clarity</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.avg_depth}</Text>
            <Text style={styles.statLabel}>Depth</Text>
          </View>
        </View>

        <View style={styles.questionsPreview}>
          <Text style={styles.questionsLabel}>QUESTIONS ASKED</Text>
          {questions.slice(0, 2).map((question, index) => (
            <Text key={`${item.id ?? 'session'}-${index}`} style={styles.questionItem} numberOfLines={1}>
              {'\u2022 '}{question}
            </Text>
          ))}
          {questions.length > 2 && (
            <Text style={styles.moreText}>+{questions.length - 2} more</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {sessions.length > 0 && (
          <Text style={styles.headerSubtitle}>
            {sessions.length} session{sessions.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.mint} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="clock" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete an interview to see your history here
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.startButtonText}>Start Interview</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item, index) => item.id ?? `${item.created_at ?? 'session'}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.mint}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: COLORS.mint,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  startButtonText: {
    color: COLORS.card,
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleBlock: {
    flex: 1,
    paddingRight: 16,
  },
  fieldName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textHint,
    marginTop: 2,
  },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
  },
  divider: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textHint,
    marginTop: 2,
  },
  questionsPreview: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  questionsLabel: {
    fontSize: 10,
    color: COLORS.textHint,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionItem: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 3,
    lineHeight: 18,
  },
  moreText: {
    fontSize: 12,
    color: COLORS.mint,
    marginTop: 4,
  },
});
