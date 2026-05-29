import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useSSO } from '@clerk/expo';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';



WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSignIn = async () => {
    if (!signInLoaded || !signIn) {
      Alert.alert('Not ready', 'Auth is still loading, please wait.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (result.status === 'complete') {
        await setSignInActive!({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Sign In Error', 'Could not complete sign in. Please try again.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? err?.message ?? 'Sign in failed.';
      Alert.alert('Sign In Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded || !signUp) {
      Alert.alert('Not ready', 'Auth is still loading, please wait.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? err?.message ?? 'Sign up failed.';
      Alert.alert('Sign Up Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded || !signUp) return;
    if (!verificationCode.trim()) {
      Alert.alert('Missing code', 'Please enter the verification code from your email.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });
      if (result.status === 'complete') {
        await setSignUpActive!({ session: result.createdSessionId });
        router.replace('/(tabs)');
      } else {
        Alert.alert('Verification Error', 'Could not verify code. Please try again.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage ?? err?.message ?? 'Verification failed.';
      Alert.alert('Verification Error', message);
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: Linking.createURL('/'),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message ?? 'Google sign in failed.');
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7F7F5" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.inner}>
              <View style={styles.verificationIcon}>
                <Feather name="mail" size={28} color="#52B788" />
              </View>
              <Text style={styles.title}>Check your inbox</Text>
              <Text style={styles.subtitle}>Enter the 6-digit verification code we sent to your email.</Text>

              <View style={styles.formCard}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="6-digit code"
                  placeholderTextColor="#ABABAB"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />

                <TouchableOpacity style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={handleVerify} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Verify Email</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={() => setPendingVerification(false)} activeOpacity={0.85}>
                  <Text style={styles.linkText}>? Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F7F5" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={styles.hero}>
              <View style={styles.logoCircle}>
                <Feather name="mic" size={24} color="#52B788" />
              </View>
              <Text style={styles.heroTitle}>InterviewAI</Text>
              <Text style={styles.heroSubtitle}>Your AI interview coach</Text>
            </View>

            <View style={styles.switcherCard}>
              <TouchableOpacity style={[styles.tabButton, mode === 'signin' && styles.tabButtonActive]} onPress={() => setMode('signin')} activeOpacity={0.85}>
                <Text style={[styles.tabButtonText, mode === 'signin' && styles.tabButtonTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, mode === 'signup' && styles.tabButtonActive]} onPress={() => setMode('signup')} activeOpacity={0.85}>
                <Text style={[styles.tabButtonText, mode === 'signup' && styles.tabButtonTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              {mode === 'signup' && (
                <View style={styles.inputRow}>
                  <Feather name="user" size={18} color="#6B6B6B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor="#ABABAB"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
              )}
              <View style={styles.inputRow}>
                <Feather name="mail" size={18} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#ABABAB"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputRow}>
                <Feather name="lock" size={18} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#ABABAB"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity style={[styles.primaryButton, loading && styles.buttonDisabled]} onPress={mode === 'signin' ? handleSignIn : handleSignUp} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
                <Feather name="globe" size={18} color="#1A1A1A" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  inner: {
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#D8F3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  verificationIcon: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: '#D8F3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6B6B6B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  switcherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#52B788',
  },
  tabButtonText: {
    color: '#6B6B6B',
    fontSize: 15,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    padding: 22,
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  primaryButton: {
    backgroundColor: '#52B788',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EBEBEB',
  },
  dividerText: {
    color: '#9A9A9A',
    fontSize: 13,
    marginHorizontal: 12,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  linkText: {
    color: '#52B788',
    fontSize: 14,
    fontWeight: '700',
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#F7F7F5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    paddingVertical: 18,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 16,
    textAlign: 'center',
    color: '#1A1A1A',
  },
});
