import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from './src/auth/auth-provider';
import { VendorHomeScreen } from './src/screens/vendor-home-screen';
import { VendorLoginScreen } from './src/screens/vendor-login-screen';

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#7ed9a4" />
        <Text style={styles.loadingText}>Restoring secure session…</Text>
      </View>
    );
  }

  if (status === 'misconfigured') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.configTitle}>Authentication is not configured</Text>
        <Text style={styles.configCopy}>
          Copy .env.example to .env.local and add the Supabase project URL and publishable key.
        </Text>
      </SafeAreaView>
    );
  }

  if (status === 'authenticated') return <VendorHomeScreen />;
  return <VendorLoginScreen />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#0d3427',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: { color: '#c5dacd', fontSize: 13, marginTop: 12 },
  configTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  configCopy: { color: '#b8d0c2', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
});
