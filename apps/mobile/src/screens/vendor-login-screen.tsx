import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
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
      setValidation('Please enter your vendor email and password.');
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Hero Section */}
          <View style={styles.hero}>
            <View style={styles.logoRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoEmoji}>🌱</Text>
              </View>
              <View>
                <Text style={styles.brandTitle}>FreshLens AI</Text>
                <Text style={styles.brandSubtitle}>Intelligent Quality & Inventory</Text>
              </View>
            </View>

            <View style={styles.heroTag}>
              <Text style={styles.heroTagDot}>●</Text>
              <Text style={styles.heroTagText}>Enterprise Vendor Portal</Text>
            </View>

            <Text style={styles.headline}>Automated produce inspection at your fingertips.</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Sign In</Text>
            <Text style={styles.cardSub}>Enter your credentials to access your store workspace.</Text>

            {validation || message ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{validation ?? message}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vendor Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="vendor@freshlens.local"
                  placeholderTextColor="#94a3b8"
                  editable={!pending}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  editable={!pending}
                  onSubmitEditing={() => void submit()}
                />
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                pending && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={() => void submit()}
              disabled={pending}
              accessibilityRole="button"
            >
              {pending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In to Workspace →</Text>
              )}
            </Pressable>

            {/* Security Badge */}
            <View style={styles.securityRow}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                Encrypted JWT Session · Partitioned Tenant Isolation
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#061a13' },
  keyboard: { flex: 1 },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
    paddingVertical: 36,
  },
  hero: { marginBottom: 28 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoEmoji: { fontSize: 22 },
  brandTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  brandSubtitle: { color: '#86efac', fontSize: 12, fontWeight: '600' },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginBottom: 12,
  },
  heroTagDot: { color: '#10b981', fontSize: 8 },
  heroTagText: { color: '#86efac', fontSize: 11, fontWeight: '700' },
  headline: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: { color: '#0f172a', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  cardSub: { color: '#64748b', fontSize: 13, marginTop: 4, marginBottom: 20 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, color: '#dc2626', fontSize: 12, fontWeight: '600' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.65 },
  btnPressed: { backgroundColor: '#059669' },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  securityIcon: { fontSize: 12 },
  securityText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
});

