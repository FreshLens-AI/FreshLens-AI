import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/auth-provider';
import { configureNotificationHandler } from './src/lib/push/register';
import { VendorNavigator } from './src/navigation/vendor-navigator';
import { VendorLoginScreen } from './src/screens/vendor-login-screen';
import { PasswordSetupScreen } from './src/screens/password-setup-screen';
import { TenantApplicationScreen } from './src/screens/tenant-application-screen';

configureNotificationHandler();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const { status } = useAuth();
  const [showTenantApplication, setShowTenantApplication] = useState(false);

  useEffect(() => {
    if (status !== 'unauthenticated') setShowTenantApplication(false);
  }, [status]);

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
          Copy .env.example to .env.local and add the Supabase project URL and
          publishable key.
        </Text>
      </SafeAreaView>
    );
  }

  if (status === 'password-setup') return <PasswordSetupScreen />;
  if (status === 'authenticated') return <VendorNavigator />;
  if (showTenantApplication) {
    return <TenantApplicationScreen onBackToSignIn={() => setShowTenantApplication(false)} />;
  }
  return <VendorLoginScreen onApplyForTenant={() => setShowTenantApplication(true)} />;
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
  configTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  configCopy: {
    color: '#b8d0c2',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
});
