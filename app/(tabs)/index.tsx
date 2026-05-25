import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(5);

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const fields = [
    { id: 'frontend', label: 'Frontend', icon: '🎨' },
    { id: 'backend', label: 'Backend', icon: '⚙️' },
    { id: 'mobile', label: 'Mobile', icon: '📱' },
    { id: 'general', label: 'General', icon: '💡' },
  ];

  const handleStart = () => {
    if (!selectedField) return;
    setModalVisible(false);
    router.push({
      pathname: '/interview/session',
      params: {
        field: selectedField,
        totalQuestions: questionCount,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Hey, {user?.firstName ?? 'there'} 👋</Text>
          <Text style={styles.appSubtitle}>Ready to practice?</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* CENTER CONTENT */}
        <View style={styles.motivationalCard}>
          <Text style={styles.cardTitle}>Ready to practice?</Text>
          <Text style={styles.cardSubtitle}>
            AI will interview you, transcribe your answers and give real feedback.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Interview</Text>
        </TouchableOpacity>

        {/* BOTTOM SECTION */}
        <View style={styles.bottomSection}>
          <Text style={styles.bottomLabel}>Practice Makes Perfect</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={styles.statText}>Role Based</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>🎙️</Text>
              <Text style={styles.statText}>Voice Answers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statEmoji}>🤖</Text>
              <Text style={styles.statText}>AI Feedback</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* INTERVIEW SETUP MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* CLOSE BUTTON */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>

            {/* SECTION 1 — Pick your field */}
            <Text style={styles.modalSectionTitle}>What field?</Text>
            <View style={styles.fieldGrid}>
              {fields.map((field) => {
                const isSelected = selectedField === field.id;
                return (
                  <TouchableOpacity
                    key={field.id}
                    style={[
                      styles.fieldCard,
                      isSelected ? styles.fieldCardSelected : styles.fieldCardUnselected,
                    ]}
                    onPress={() => setSelectedField(field.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.fieldCardText}>
                      {field.icon} {field.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SECTION 2 — Number of questions */}
            <Text style={[styles.modalSectionTitle, { marginTop: 24 }]}>
              How many questions?
            </Text>
            <View style={styles.pillsRow}>
              {[3, 5, 10].map((count) => {
                const isSelected = questionCount === count;
                return (
                  <TouchableOpacity
                    key={count}
                    style={[
                      styles.pillButton,
                      isSelected ? styles.pillButtonSelected : styles.pillButtonUnselected,
                    ]}
                    onPress={() => setQuestionCount(count)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pillButtonText}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SECTION 3 — Start button */}
            <TouchableOpacity
              style={[
                styles.goButton,
                !selectedField ? styles.goButtonDisabled : styles.goButtonEnabled,
              ]}
              disabled={!selectedField}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Text style={styles.goButtonText}>Let's Go 🚀</Text>
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
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 24,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appSubtitle: {
    color: '#8E8E93',
    fontSize: 14,
  },
  motivationalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardSubtitle: {
    color: '#8E8E93',
    fontSize: 15,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: '#7F77DD',
    borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 24,
    alignItems: 'center',
    marginBottom: 40,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomSection: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  bottomLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  closeButtonText: {
    color: '#8E8E93',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  fieldCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCardUnselected: {
    backgroundColor: '#2C2C2E',
  },
  fieldCardSelected: {
    backgroundColor: '#7F77DD',
  },
  fieldCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pillButton: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pillButtonUnselected: {
    backgroundColor: '#2C2C2E',
  },
  pillButtonSelected: {
    backgroundColor: '#7F77DD',
  },
  pillButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  goButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  goButtonEnabled: {
    backgroundColor: '#7F77DD',
  },
  goButtonDisabled: {
    backgroundColor: '#444446',
  },
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  logoutText: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '500',
  },
});