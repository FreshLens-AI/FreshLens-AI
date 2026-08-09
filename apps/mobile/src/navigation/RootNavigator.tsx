import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Alert as RNAlert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import type { CameraCapturedPicture } from 'expo-camera';
import { supabase } from '../lib/supabase';
import { submitScan, ApiError } from '../lib/api';
import LoginScreen from '../screens/LoginScreen';
import ScanCaptureScreen from '../screens/ScanCaptureScreen';
import QuantityConfirmScreen from '../screens/QuantityConfirmScreen';
import ScanStatusScreen from '../screens/ScanStatusScreen';

function DashboardScreen({ onStartScan }: { onStartScan: () => void }) {
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Inventory Dashboard — coming soon</Text>
      <TouchableOpacity style={styles.scanButton} onPress={onStartScan}>
        <Text style={styles.scanButtonText}>Start Scan</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function PlaceholderScreen({ label }: { label: string }) {
  async function handleLogout() {
    await supabase.auth.signOut();
  }
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label} — coming soon</Text>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

type Step =
  | { name: 'capture' }
  | { name: 'confirm'; photo: CameraCapturedPicture }
  | { name: 'submitting'; photo: CameraCapturedPicture; quantity: number }
  | { name: 'status'; scanId: string };

function ScanFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'capture' });

  console.log('ScanFlow render, step:', step.name);

  if (step.name === 'capture') {
    return <ScanCaptureScreen onImageAccepted={(photo) => setStep({ name: 'confirm', photo })} />;
  }

  if (step.name === 'confirm') {
    return (
      <QuantityConfirmScreen
        photo={step.photo}
        onBack={() => setStep({ name: 'capture' })}
        onConfirm={async (quantity) => {
          console.log('onConfirm fired, quantity:', quantity, 'photo uri:', step.photo.uri);
          setStep({ name: 'submitting', photo: step.photo, quantity });
          try {
            console.log('Calling submitScan...');
            const accepted = await submitScan(step.photo.uri, quantity);
            console.log('submitScan succeeded:', accepted);
            setStep({ name: 'status', scanId: accepted.id });
          } catch (err) {
            console.error('SUBMIT SCAN FAILED:', err);
            console.error('Error type:', typeof err, err instanceof Error ? err.message : String(err));
            const message = err instanceof ApiError ? err.message : 'Could not submit scan. Check your connection and try again.';
            RNAlert.alert('Scan Submission Failed', message, [
              { text: 'Retry', onPress: () => setStep({ name: 'confirm', photo: step.photo }) },
              { text: 'Cancel', style: 'cancel', onPress: onDone },
            ]);
          }
        }}
      />
    );
  }

  if (step.name === 'submitting') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.hint}>Submitting scan…</Text>
      </View>
    );
  }

  return <ScanStatusScreen scanId={step.scanId} onDone={onDone} />;
}

const Stack = createNativeStackNavigator();

function AuthenticatedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Dashboard">
        {({ navigation }) => <DashboardScreen onStartScan={() => navigation.navigate('Scan')} />}
      </Stack.Screen>
      <Stack.Screen
        name="Scan"
        children={({ navigation }) => (
          <ScanFlow onDone={() => navigation.navigate('Dashboard')} />
        )}
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <Stack.Screen name="Alerts" children={() => <PlaceholderScreen label="Alerts" />} />
    </Stack.Navigator>
  );
}

function UnauthenticatedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AuthenticatedStack /> : <UnauthenticatedStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { fontSize: 14, color: '#666' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  placeholderText: { fontSize: 16, color: '#333' },
  scanButton: { backgroundColor: '#2E7D32', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8, borderWidth: 1, borderColor: '#B3261E' },
  logoutText: { color: '#B3261E', fontSize: 15, fontWeight: '600' },
});
