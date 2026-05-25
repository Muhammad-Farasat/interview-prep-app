import { View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Dimensions } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { getUserSessions, SessionRecord } from '../../services/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48; // 24px padding each side

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={statStyles.card}>
      <Text
        style={[statStyles.value, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={statStyles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    minWidth: 60,
  },
  value: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({
  data,
  label,
  color,
}: {
  data: { x: string; y: number }[];
  label: string;
  color: string;
}) {
  if (data.length === 0) return null;

  const maxVal = 100; // scores are 0-100
  const barWidth = Math.max(12, Math.floor((CHART_WIDTH - data.length * 6) / data.length));
  const chartHeight = 120;

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>{label}</Text>
      <View style={[chartStyles.chart, { height: chartHeight }]}>
        {/* Y-axis labels */}
        <View style={chartStyles.yAxis}>
          {[100, 75, 50, 25, 0].map(v => (
            <Text key={v} style={chartStyles.yLabel}>{v}</Text>
          ))}
        </View>
        {/* Bars */}
        <View style={chartStyles.barsArea}>
          {data.map((d, i) => {
            const barH = Math.max(2, (d.y / maxVal) * chartHeight);
            return (
              <View key={i} style={[chartStyles.barCol, { width: barWidth }]}>
                <View style={chartStyles.barTrack}>
                  <View
                    style={[
                      chartStyles.bar,
                      { height: barH, backgroundColor: color, width: barWidth - 4 },
                    ]}
                  />
                </View>
                <Text style={chartStyles.xLabel} numberOfLines={1}>{d.x}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  yAxis: {
    width: 28,
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: {
    color: '#555',
    fontSize: 9,
  },
  barsArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '100%',
  },
  barCol: {
    alignItems: 'center',
  },
  barTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    borderRadius: 3,
  },
  xLabel: {
    color: '#555',
    fontSize: 8,
    marginTop: 4,
    textAlign: 'center',
  },
});

// ─── Skill bar ────────────────────────────────────────────────────────────────

function SkillBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={skillStyles.row}>
      <Text style={skillStyles.label}>{label}</Text>
      <View style={skillStyles.track}>
        <View style={[skillStyles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[skillStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const skillStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#8E8E93',
    fontSize: 13,
    width: 72,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { userId } = useAuth();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#7F77DD" />
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySubtitle}>
          Complete your first interview to see progress charts here.
        </Text>
      </View>
    );
  }

  // ── Derived stats ────────────────────────────────────────────────────────

  // Most recent 10 sessions (oldest first for chart left→right)
  const recent = [...sessions].reverse().slice(-10);

  const totalSessions = sessions.length;
  const overallAvgScore = Math.round(
    sessions.reduce((s, r) => s + r.avg_score, 0) / sessions.length
  );
  const bestScore = Math.max(...sessions.map(r => r.avg_score));

  // Trend: compare last 3 vs previous 3
  const last3 = sessions.slice(0, 3);
  const prev3 = sessions.slice(3, 6);
  const last3Avg = last3.length
    ? Math.round(last3.reduce((s, r) => s + r.avg_score, 0) / last3.length)
    : 0;
  const prev3Avg = prev3.length
    ? Math.round(prev3.reduce((s, r) => s + r.avg_score, 0) / prev3.length)
    : last3Avg;
  const trend = last3Avg - prev3Avg;
  const trendLabel = trend > 0 ? `+${trend}` : trend < 0 ? `${trend}` : '—';
  const trendColor = trend > 0 ? '#4CAF50' : trend < 0 ? '#F44336' : '#8E8E93';

  // Skill averages
  const avgClarity = Math.round(
    sessions.reduce((s, r) => s + r.avg_clarity, 0) / sessions.length
  );
  const avgDepth = Math.round(
    sessions.reduce((s, r) => s + r.avg_depth, 0) / sessions.length
  );

  // Score color
  const scoreColor = (s: number) =>
    s >= 75 ? '#4CAF50' : s >= 50 ? '#FF9800' : '#F44336';

  // Chart data
  const scoreChartData = recent.map((r, i) => ({
    x: `#${sessions.length - recent.length + i + 1}`,
    y: r.avg_score,
  }));
  const clarityChartData = recent.map((r, i) => ({
    x: `#${sessions.length - recent.length + i + 1}`,
    y: r.avg_clarity,
  }));
  const depthChartData = recent.map((r, i) => ({
    x: `#${sessions.length - recent.length + i + 1}`,
    y: r.avg_depth,
  }));

  // Field breakdown
  const fieldCounts: Record<string, { count: number; totalScore: number }> = {};
  sessions.forEach(r => {
    if (!fieldCounts[r.field]) fieldCounts[r.field] = { count: 0, totalScore: 0 };
    fieldCounts[r.field].count += 1;
    fieldCounts[r.field].totalScore += r.avg_score;
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Summary stats ── */}
      <View style={styles.statsRow}>
        <StatCard label="Sessions" value={totalSessions} color="#FFFFFF" />
        <StatCard label="Avg Score" value={overallAvgScore} color={scoreColor(overallAvgScore)} />
        <StatCard label="Best" value={bestScore} color="#4CAF50" />
        <StatCard label="Trend" value={trendLabel} color={trendColor} />
      </View>

      {/* ── Score over time ── */}
      <BarChart data={scoreChartData} label="Score over time" color="#7F77DD" />

      {/* ── Skill averages ── */}
      <View style={styles.skillCard}>
        <Text style={styles.sectionTitle}>Skill Averages</Text>
        <SkillBar label="Score" value={overallAvgScore} color={scoreColor(overallAvgScore)} />
        <SkillBar label="Clarity" value={avgClarity} color="#7F77DD" />
        <SkillBar label="Depth" value={avgDepth} color="#5AC8FA" />
      </View>

      {/* ── Clarity & Depth charts ── */}
      <BarChart data={clarityChartData} label="Clarity over time" color="#7F77DD" />
      <BarChart data={depthChartData} label="Depth over time" color="#5AC8FA" />

      {/* ── Field breakdown ── */}
      <View style={styles.skillCard}>
        <Text style={styles.sectionTitle}>By Field</Text>
        {Object.entries(fieldCounts).map(([field, { count, totalScore }]) => {
          const avg = Math.round(totalScore / count);
          return (
            <View key={field} style={styles.fieldRow}>
              <Text style={styles.fieldName}>
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </Text>
              <Text style={styles.fieldCount}>{count} session{count !== 1 ? 's' : ''}</Text>
              <Text style={[styles.fieldScore, { color: scoreColor(avg) }]}>{avg}</Text>
            </View>
          );
        })}
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    marginHorizontal: -4,
  },
  skillCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  fieldName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  fieldCount: {
    color: '#8E8E93',
    fontSize: 12,
    marginRight: 12,
  },
  fieldScore: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 36,
    textAlign: 'right',
  },
});
