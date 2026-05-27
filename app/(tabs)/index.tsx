import { Feather } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getUserSessions } from '../../services/supabase';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';

const tips = [
  'Use the STAR method: Situation, Task, Action, Result.',
  'Pause before answering - it shows confidence, not weakness.',
  'Mention metrics when possible. Numbers stand out.',
  'Practice out loud, not just in your head.',
  "It's okay to say 'I don't know, but here's how I'd approach it.'",
];

const fieldSuggestions = [
  'Frontend',
  'Backend',
  'Mobile',
  'Data Science',
  'DevOps',
  'UI/UX',
  'Machine Learning',
  'Cybersecurity',
  'Cloud',
  'QA Testing',
];

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRecentDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${monthLabels[date.getMonth()]} ${date.getDate()}`;
}

type RecentSession = {
  id?: string | number;
  field?: string;
  role?: string;
  score?: number;
  avg_score?: number;
  date?: string | Date;
  created_at?: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, userId } = useAuth();
  const { user } = useUser();
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [fieldInput, setFieldInput] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);

  const firstInitial = user?.firstName?.[0]?.toUpperCase() ?? 'U';
  const tipOfTheDay = tips[new Date().getDay() % tips.length];
  const recentSessions = sessions.slice(0, 3);
  const dropdownTop = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) + 70;
  const trimmedFieldInput = fieldInput.trim();
  const normalizedFieldInput = trimmedFieldInput.toLowerCase();
  const filteredSuggestions = normalizedFieldInput
    ? fieldSuggestions.filter(suggestion => suggestion.toLowerCase().includes(normalizedFieldInput))
    : fieldSuggestions;
  const hasExactFieldMatch = fieldSuggestions.some(
    suggestion => suggestion.toLowerCase() === normalizedFieldInput
  );
  const visibleSuggestions = normalizedFieldInput && !hasExactFieldMatch
    ? [trimmedFieldInput, ...filteredSuggestions]
    : filteredSuggestions;

  useEffect(() => {
    if (!userId) {
      setSessions([]);
      return;
    }

    (async () => {
      try {
        const data = await getUserSessions(userId);
        setSessions((data ?? []) as RecentSession[]);
      } catch (err) {
        console.error('Home sessions fetch error:', err);
        setSessions([]);
      }
    })();
  }, [userId]);

  const handleLogout = async () => {
    setDropdownVisible(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleStart = () => {
    const field = selectedField?.trim() || trimmedFieldInput;
    if (!field) return;
    setModalVisible(false);
    router.push({
      pathname: '/interview/session',
      params: {
        field,
        difficulty,
        totalQuestions: String(questionCount),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F5" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.pagePadding}>
          <View style={styles.headerRow}>
            <Text style={styles.appTitle}>InterviewAI</Text>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={() => setDropdownVisible(prev => !prev)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>{firstInitial}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.greetingSection}>
            <Text style={styles.greetingTitle}>Hey, {user?.firstName ?? 'there'} 👋</Text>
            <Text style={styles.greetingSubtitle}>Ready for your next interview?</Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipIcon}>💡</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipLabel}>Tip of the day</Text>
              <Text style={styles.tipText}>{tipOfTheDay}</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.dot} />
              <Text style={styles.heroTag}>AI Powered</Text>
            </View>
            <Text style={styles.heroTitle}>Start your interview</Text>
            <Text style={styles.heroSubtitle}>
              AI asks questions, you answer with voice. Get instant feedback.
            </Text>
            <TouchableOpacity style={styles.heroButton} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
              <Text style={styles.heroButtonText}>Start Interview</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" style={styles.heroButtonIcon} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Feather name="mic" size={20} color="#52B788" />
              <Text style={styles.statLabel}>Voice</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="cpu" size={20} color="#52B788" />
              <Text style={styles.statLabel}>AI</Text>
            </View>
            <View style={styles.statCard}>
              <Feather name="bar-chart-2" size={20} color="#52B788" />
              <Text style={styles.statLabel}>Track</Text>
            </View>
          </View>

          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>RECENT</Text>
            {recentSessions.length === 0 ? (
              <View style={styles.recentRow}>
                <Text style={styles.recentText}>No sessions yet</Text>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentSessions.map((session, index) => {
                  const field = session.field ?? session.role ?? 'General';
                  const score = session.score ?? session.avg_score ?? 0;
                  const dateValue = session.date ?? session.created_at ?? new Date();
                  const formattedDate = formatRecentDate(dateValue);

                  return (
                    <TouchableOpacity
                      key={session.id ?? `${field}-${index}`}
                      style={styles.sessionRow}
                      onPress={() => {}}
                      activeOpacity={0.85}
                    >
                      <View style={styles.sessionMain}>
                        <View style={styles.fieldBadge}>
                          <Text style={styles.fieldBadgeText}>
                            {field.charAt(0).toUpperCase() + field.slice(1)}
                          </Text>
                        </View>
                        <Text style={styles.sessionDate}>{formattedDate}</Text>
                      </View>
                      <Text style={[styles.sessionScore, { color: score < 50 ? '#B71C1C' : '#2D6A4F' }]}>
                        {score}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {dropdownVisible && (
        <>
          <TouchableOpacity
            style={styles.dropdownBackdrop}
            onPress={() => setDropdownVisible(false)}
            activeOpacity={1}
          />
          <View style={[styles.dropdownMenu, { top: dropdownTop }]}>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout} activeOpacity={0.85}>
              <Feather name="log-out" size={16} color="#1A1A1A" />
              <Text style={styles.dropdownItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Set up interview</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color="#ABABAB" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>Choose field</Text>
            <TextInput
              style={styles.fieldInput}
              value={fieldInput}
              onChangeText={(text) => {
                setFieldInput(text);
                setSelectedField(text.trim() || null);
              }}
              placeholder="e.g. Data Science, DevOps, iOS..."
              placeholderTextColor="#ABABAB"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsContent}
            >
              {visibleSuggestions.map((field) => {
                const isSelected = selectedField?.toLowerCase() === field.toLowerCase();
                return (
                  <TouchableOpacity
                    key={field}
                    style={[styles.suggestionPill, isSelected && styles.suggestionPillSelected]}
                    onPress={() => {
                      setSelectedField(field);
                      setFieldInput(field);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.suggestionPillText, isSelected && styles.suggestionPillTextSelected]}>
                      {field}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionLabel}>Difficulty</Text>
            <View style={styles.pillsRow}>
              {[
                { value: 'easy', label: 'Easy', bg: '#D8F3E8', text: '#2D6A4F' },
                { value: 'medium', label: 'Medium', bg: '#FFF3CD', text: '#856404' },
                { value: 'hard', label: 'Hard', bg: '#F8D7DA', text: '#842029' },
              ].map((option) => {
                const isSelected = difficulty === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.pillButton,
                      styles.pillButtonUnselected,
                      isSelected && { backgroundColor: option.bg, borderColor: option.bg },
                    ]}
                    onPress={() => setDifficulty(option.value as 'easy' | 'medium' | 'hard')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillButtonText, isSelected && { color: option.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, styles.questionsLabel]}>Number of questions</Text>
            <View style={styles.pillsRow}>
              {[3, 5, 10].map((count) => {
                const isSelected = questionCount === count;
                return (
                  <TouchableOpacity
                    key={count}
                    style={[styles.pillButton, isSelected ? styles.pillButtonSelected : styles.pillButtonUnselected]}
                    onPress={() => setQuestionCount(count)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillButtonText, isSelected && styles.pillButtonTextSelected]}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.goButton, !trimmedFieldInput ? styles.goButtonDisabled : styles.goButtonEnabled]}
              disabled={!trimmedFieldInput}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Text style={[styles.goButtonText, !trimmedFieldInput && styles.goButtonTextDisabled]}>Let's Go</Text>
              <Feather name="arrow-right" size={16} color={!trimmedFieldInput ? '#ABABAB' : '#FFFFFF'} style={styles.goButtonIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  pagePadding: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 24 : 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D8F3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '600',
  },
  greetingSection: {
    marginTop: 24,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  greetingSubtitle: {
    marginTop: 4,
    fontSize: 16,
    color: '#6B6B6B',
  },
  tipCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipLabel: {
    fontSize: 11,
    color: '#ABABAB',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipText: {
    marginTop: 4,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  heroCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    padding: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#52B788',
  },
  heroTag: {
    marginLeft: 6,
    fontSize: 12,
    color: '#52B788',
    fontWeight: '600',
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  heroButton: {
    marginTop: 16,
    backgroundColor: '#52B788',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  heroButtonIcon: {
    marginLeft: 8,
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  recentSection: {
    marginTop: 24,
  },
  recentTitle: {
    fontSize: 12,
    color: '#ABABAB',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recentRow: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    padding: 16,
  },
  recentText: {
    fontSize: 16,
    color: '#6B6B6B',
  },
  recentList: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    overflow: 'hidden',
  },
  sessionRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: '#EBEBEB',
  },
  sessionMain: {
    flex: 1,
  },
  fieldBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D8F3E8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fieldBadgeText: {
    fontSize: 12,
    color: '#2D6A4F',
    fontWeight: '700',
  },
  sessionDate: {
    marginTop: 6,
    fontSize: 12,
    color: '#ABABAB',
  },
  sessionScore: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  dropdownMenu: {
    position: 'absolute',
    right: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    minWidth: 140,
    paddingVertical: 6,
    zIndex: 11,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F7F7F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalIndicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EBEBEB',
    marginBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 13,
    color: '#ABABAB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionsLabel: {
    marginTop: 24,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  suggestionsScroll: {
    marginTop: 12,
  },
  suggestionsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  suggestionPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionPillSelected: {
    backgroundColor: '#D8F3E8',
    borderColor: '#52B788',
  },
  suggestionPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  suggestionPillTextSelected: {
    color: '#2D6A4F',
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pillButton: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#EBEBEB',
  },
  pillButtonSelected: {
    backgroundColor: '#52B788',
    borderWidth: 0,
  },
  pillButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  pillButtonTextSelected: {
    color: '#FFFFFF',
  },
  goButton: {
    marginTop: 24,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButtonEnabled: {
    backgroundColor: '#52B788',
  },
  goButtonDisabled: {
    backgroundColor: '#EBEBEB',
  },
  goButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goButtonTextDisabled: {
    color: '#ABABAB',
  },
  goButtonIcon: {
    marginLeft: 8,
  },
});
