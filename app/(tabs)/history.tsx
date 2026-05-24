import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { getUserSessions, SessionRecord } from '../../services/supabase';
import { useRouter } from 'expo-router';

export default function HistoryScreen() {
  const { userId } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    if (!userId) return;
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

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    return '#F44336';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderSession = ({ item }: { item: SessionRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.fieldLabel}>
            {item.field.charAt(0).toUpperCase() + item.field.slice(1)}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.created_at ?? '')}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.avg_score) + '22' }]}>
          <Text style={[styles.scoreText, { color: getScoreColor(item.avg_score) }]}>
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
        <Text style={styles.questionsLabel}>Questions asked:</Text>
        {(item.questions ?? []).slice(0, 2).map((q, i) => (
          <Text key={i} style={styles.questionItem} numberOfLines={1}>
            • {q}
          </Text>
        ))}
        {(item.questions ?? []).length > 2 && (
          <Text style={styles.moreText}>+{item.questions.length - 2} more</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7F77DD" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>History</Text>

      {sessions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🎙️</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete an interview to see your history here
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.startButtonText}>Start Interview</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id ?? Math.random().toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7F77DD"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    padding: 20,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#7F77DD',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  questionsPreview: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 10,
  },
  questionsLabel: {
    color: '#8E8E93',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  questionItem: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 3,
    lineHeight: 18,
  },
  moreText: {
    color: '#7F77DD',
    fontSize: 12,
    marginTop: 4,
  },
});
