import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useAuth } from '../auth/auth-provider';

export function PasswordSetupScreen() {
  const { message, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await updatePassword(password);
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>Set your password</Text>
          <Text style={styles.description}>Choose a password for your FreshLens vendor account.</Text>
          {error || message ? <Text style={styles.error}>{error ?? message}</Text> : null}
          <TextInput
            style={styles.input} placeholder="New password" secureTextEntry
            autoComplete="new-password" value={password} onChangeText={setPassword}
            editable={!pending}
          />
          <TextInput
            style={styles.input} placeholder="Confirm password" secureTextEntry
            autoComplete="new-password" value={confirmation} onChangeText={setConfirmation}
            editable={!pending}
          />
          <Pressable style={styles.button} onPress={() => void submit()} disabled={pending} accessibilityRole="button">
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save password</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#061a13' },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 },
  title: { color: '#0f172a', fontSize: 23, fontWeight: '800' },
  description: { color: '#64748b', fontSize: 14, lineHeight: 20 },
  error: { color: '#b91c1c', fontSize: 13 },
  input: { borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15 },
  button: { backgroundColor: '#059669', borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
});
