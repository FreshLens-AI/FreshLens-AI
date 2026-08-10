import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../auth/auth-provider';

export function VendorLoginScreen() {
  const { message, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  async function submit() {
    if (!email.includes('@') || !password) {
      setValidation('Enter your vendor email and password.');
      return;
    }
    setValidation(null);
    setPending(true);
    try {
      await signIn(email, password);
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.mark}><Text style={styles.markText}>FL</Text></View>
          <Text style={styles.brand}>FreshLens</Text>
          <Text style={styles.eyebrow}>Vendor workspace</Text>
          <Text style={styles.title}>Know what’s fresh. Act before it’s wasted.</Text>
          <Text style={styles.subtitle}>
            Sign in to scan produce, review results, and follow inventory alerts for your shop.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Use the vendor account assigned to your organization.</Text>

          {validation || message ? (
            <Text style={styles.error} accessibilityRole="alert">
              {validation ?? message}
            </Text>
          ) : null}

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@yourshop.com"
            placeholderTextColor="#849188"
            editable={!pending}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Enter your password"
            placeholderTextColor="#849188"
            editable={!pending}
            onSubmitEditing={() => void submit()}
          />

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => void submit()}
            disabled={pending}
            accessibilityRole="button"
          >
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Text style={styles.footnote}>Your session is encrypted on this device.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0d3427' },
  keyboard: { flex: 1, justifyContent: 'center', padding: 22 },
  hero: { marginBottom: 28 },
  mark: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#289361', marginBottom: 12 },
  markText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '800' },
  eyebrow: { color: '#8fe1b1', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 24 },
  title: { color: '#fff', fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.8, marginTop: 8 },
  subtitle: { color: '#b8d0c2', fontSize: 14, lineHeight: 21, marginTop: 10 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 22 },
  cardTitle: { color: '#17221c', fontSize: 23, fontWeight: '800' },
  cardSubtitle: { color: '#627067', fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 20 },
  error: { color: '#a83f35', backgroundColor: '#fff3f1', borderRadius: 9, padding: 11, fontSize: 12, marginBottom: 14 },
  label: { color: '#27362d', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: '#d5dfd8', borderRadius: 11, color: '#17221c', paddingHorizontal: 13, marginBottom: 16, backgroundColor: '#fbfcfb' },
  button: { height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#196a49', marginTop: 2 },
  buttonPressed: { backgroundColor: '#14563b' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  footnote: { color: '#7a877e', fontSize: 11, textAlign: 'center', marginTop: 14 },
});
