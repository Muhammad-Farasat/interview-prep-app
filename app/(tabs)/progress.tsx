import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { getUserSessions } from '../../services/supabase';
import { BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

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

type SessionRecord = Awaited<ReturnType<typeof getUserSessions>>[number];

const getScoreColor = (score: number) => {
  if (score >= 75) return '#2D6A4F';
  if (score >= 50) return '#E65100';
  return '#B71C1C';
};

const getScoreBg = (score: number) => {
  if (score >= 75) return '#D8F3E8';
  if (score >= 50) return '#FFF3E0';
  return '#FFEBEE';
};

function formatField(field: string) {
  return field.charAt(0).toUpperCase() + field.slice(1);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function StatCard({
  label,
  value,
  color = COLORS.textPrimary,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SkillRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.skillRow}>
      <Text style={styles.skillLabel}>{label}</Text>
      <View style={styles.skillTrack}>
        <View style={[styles.skillFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.skillNumber}>{value}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { userId } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await getUserSessions(userId);
        setSessions(data ?? []);
      } catch (err) {
        console.error('Progress fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const avgScore = average(sessions.map(session => session.avg_score));
  const avgClarity = average(sessions.map(session => session.avg_clarity));
  const avgDepth = average(sessions.map(session => session.avg_depth));
  const bestScore = sessions.length ? Math.max(...sessions.map(session => session.avg_score)) : 0;
  const recentSessions = [...sessions].reverse().slice(-8);
  const lastThreeAvg = average(sessions.slice(0, 3).map(session => session.avg_score));
  const previousThree = sessions.slice(3, 6);
  const previousThreeAvg = previousThree.length
    ? average(previousThree.map(session => session.avg_score))
    : lastThreeAvg;
  const trend = lastThreeAvg - previousThreeAvg;
  const trendValue = trend > 0 ? `+${trend}` : `${trend}`;
  const trendColor = trend >= 0 ? COLORS.mintDark : '#B71C1C';

  const chartData = {
    labels: recentSessions.map((_, index) => `${index + 1}`),
    datasets: [
      {
        data: recentSessions.map(session => session.avg_score),
      },
    ],
  };

  const fieldStats = Object.entries(
    sessions.reduce<Record<string, { count: number; totalScore: number }>>((acc, session) => {
      if (!acc[session.field]) acc[session.field] = { count: 0, totalScore: 0 };
      acc[session.field].count += 1;
      acc[session.field].totalScore += session.avg_score;
      return acc;
    }, {})
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.mint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <Text style={styles.headerSubtitle}>
          {sessions.length} interview{sessions.length === 1 ? '' : 's'} completed
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="trending-up" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySubtitle}>Complete interviews to see progress</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsGrid}>
            <StatCard label="Sessions" value={sessions.length} />
            <StatCard label="Avg Score" value={avgScore} color={getScoreColor(avgScore)} />
            <StatCard label="Best" value={bestScore} color={getScoreColor(bestScore)} />
            <StatCard label="Trend" value={trendValue} color={trendColor} />
          </View>

          <Text style={styles.chartTitle}>Score over time</Text>
          <View style={styles.chartCard}>
            {sessions.length < 2 ? (
              <Text style={styles.chartEmptyText}>
                Complete more interviews to see your score trend
              </Text>
            ) : (
              <BarChart
                data={chartData}
                width={screenWidth - 64}
                height={180}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: COLORS.card,
                  backgroundGradientFrom: COLORS.card,
                  backgroundGradientTo: COLORS.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(82, 183, 136, ${opacity})`,
                  labelColor: () => COLORS.textHint,
                  barPercentage: 0.6,
                }}
                style={styles.chart}
                fromZero
                showValuesOnTopOfBars
              />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Skill averages</Text>
            <SkillRow label="Score" value={avgScore} color={getScoreColor(avgScore)} />
            <SkillRow label="Clarity" value={avgClarity} color={COLORS.mint} />
            <SkillRow label="Depth" value={avgDepth} color={COLORS.mint} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>By field</Text>
            {fieldStats.map(([field, stat], index) => {
              const avg = Math.round(stat.totalScore / stat.count);
              const isLast = index === fieldStats.length - 1;

              return (
                <View key={field} style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
                  <Text style={styles.fieldName}>{formatField(field)}</Text>
                  <Text style={styles.fieldCount}>
                    {stat.count} session{stat.count === 1 ? '' : 's'}
                  </Text>
                  <View style={[styles.scorePill, { backgroundColor: getScoreBg(avg) }]}>
                    <Text style={[styles.scorePillText, { color: getScoreColor(avg) }]}>
                      {avg}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statsGrid: {
    margin: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    flexGrow: 1,
    flexBasis: '48%',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textHint,
    marginTop: 4,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  chartCard: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 212,
  },
  chart: {
    borderRadius: 12,
  },
  chartEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skillLabel: {
    width: 70,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  skillTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  skillFill: {
    height: 6,
    borderRadius: 3,
  },
  skillNumber: {
    width: 36,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    color: COLORS.textPrimary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
  },
  fieldName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  fieldCount: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.textHint,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scorePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
