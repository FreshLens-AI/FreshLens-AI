import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useAuth } from '../auth/auth-provider';

function VisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <View style={styles.eyeIcon} importantForAccessibility="no-hide-descendants">
      <View style={styles.eyePupil} />
      {!visible ? <View style={styles.eyeSlash} /> : null}
    </View>
  );
}

export function PasswordSetupScreen() {
  const { message, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
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
          <Text style={styles.description}>Choose a password for your FreshLens tenant account.</Text>
          {error || message ? <Text style={styles.error}>{error ?? message}</Text> : null}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#64748b"
              selectionColor="#047857"
              secureTextEntry={!passwordVisible}
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              editable={!pending}
              accessibilityLabel="New password"
            />
            <Pressable
              style={styles.visibilityButton}
              onPress={() => setPasswordVisible((visible) => !visible)}
              disabled={pending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide new password' : 'Show new password'}
              accessibilityState={{ disabled: pending }}
            >
              <VisibilityIcon visible={passwordVisible} />
            </Pressable>
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#64748b"
              selectionColor="#047857"
              secureTextEntry={!confirmationVisible}
              autoComplete="new-password"
              textContentType="newPassword"
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmation}
              onChangeText={setConfirmation}
              editable={!pending}
              accessibilityLabel="Confirm password"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            <Pressable
              style={styles.visibilityButton}
              onPress={() => setConfirmationVisible((visible) => !visible)}
              disabled={pending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={confirmationVisible ? 'Hide password confirmation' : 'Show password confirmation'}
              accessibilityState={{ disabled: pending }}
            >
              <VisibilityIcon visible={confirmationVisible} />
            </Pressable>
          </View>
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
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
  },
  visibilityButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    width: 22,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 11,
  },
  eyePupil: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#334155' },
  eyeSlash: {
    position: 'absolute',
    width: 27,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#334155',
    transform: [{ rotate: '42deg' }],
  },
  button: { backgroundColor: '#059669', borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
});
