import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import LoginScreen from '../screens/LoginScreen';
import ScanCaptureScreen from '../screens/ScanCaptureScreen';

// FR-V-08 Logout, wired directly for now until Dashboard/Alerts get real
// content — logout needs to be reachable from every authenticated screen,
// so it lives here rather than duplicated per screen.
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

const Stack = createNativeStackNavigator();

function AuthenticatedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        children={() => <PlaceholderScreen label="Inventory Dashboard" />}
      />
      <Stack.Screen
        name="Scan"
        children={() => (
          <ScanCaptureScreen onImageAccepted={(photo) => console.log('captured', photo.uri)} />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  placeholderText: { fontSize: 16, color: '#333' },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B3261E',
  },
  logoutText: { color: '#B3261E', fontSize: 15, fontWeight: '600' },
});
