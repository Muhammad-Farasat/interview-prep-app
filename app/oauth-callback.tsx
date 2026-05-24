import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';

export default function OAuthCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000',
      justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#7F77DD" />
    </View>
  );
}
