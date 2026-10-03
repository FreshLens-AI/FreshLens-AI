import { useEffect, useState } from 'react';
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
import { authPreferences } from '../lib/auth/secure-storage';
import { passwordResetHelpCopy } from '../lib/auth/sign-in-errors';

export function VendorLoginScreen() {
  const { message, signIn, requestPasswordReset, clearMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remembered = await authPreferences.getRememberedEmail();
      if (cancelled) return;
      if (remembered) {
        setEmail(remembered);
        setRememberEmail(true);
      }
      setPrefsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!email.includes('@') || !password) {
      setValidation('Please enter your vendor email and password.');
      return;
    }
    setValidation(null);
    clearMessage();
    setPending(true);
    try {
      const ok = await signIn(email, password);
      if (ok) {
        await authPreferences.setRememberedEmail(rememberEmail ? email : null);
      }
    } finally {
      setPending(false);
    }
  }

  async function onForgotPassword() {
    setShowHelp(true);
    setValidation(null);
    if (!email.includes('@')) {
      setValidation('Enter your vendor email above, then tap Send reset email.');
      return;
    }
    setResetPending(true);
    try {
      await requestPasswordReset(email);
    } finally {
      setResetPending(false);
    }
  }

  const busy = pending || resetPending || !prefsReady;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
            <Text style={styles.headline}>
              Automated produce inspection at your fingertips.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeader}>Sign in</Text>
            <Text style={styles.cardSub}>
              Use the vendor email and temporary password from your store admin.
            </Text>

            {validation || message ? (
              <View
                style={[
                  styles.errorBanner,
                  message?.includes('reset link') ? styles.infoBanner : null,
                ]}
                accessibilityRole="alert"
              >
                <Text style={styles.errorIcon}>
                  {message?.includes('reset link') ? '✉️' : '⚠️'}
                </Text>
                <Text
                  style={[
                    styles.errorText,
                    message?.includes('reset link') ? styles.infoText : null,
                  ]}
                >
                  {validation ?? message}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vendor Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setValidation(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="vendor@freshlens.local"
                  placeholderTextColor="#94a3b8"
                  editable={!busy}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setValidation(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  editable={!busy}
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  disabled={busy}
                >
                  <Text style={styles.eyeBtnText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.rememberRow}
              onPress={() => setRememberEmail((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberEmail }}
              disabled={busy}
            >
              <View style={[styles.checkbox, rememberEmail && styles.checkboxChecked]}>
                {rememberEmail ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberLabel}>Remember email on this device</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                busy && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={() => void submit()}
              disabled={busy}
              accessibilityRole="button"
            >
              {pending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Sign In to Workspace →</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.forgotBtn}
              onPress={() => void onForgotPassword()}
              disabled={busy}
              accessibilityRole="button"
            >
              {resetPending ? (
                <ActivityIndicator color="#0f766e" />
              ) : (
                <Text style={styles.forgotText}>Forgot password?</Text>
              )}
            </Pressable>

            {showHelp ? (
              <View style={styles.helpBox}>
                <Text style={styles.helpTitle}>Need an account?</Text>
                <Text style={styles.helpCopy}>{passwordResetHelpCopy()}</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowHelp(true)}
                accessibilityRole="button"
                style={styles.helpToggle}
              >
                <Text style={styles.helpToggleText}>Need an account?</Text>
              </Pressable>
            )}
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
  cardSub: { color: '#64748b', fontSize: 13, marginTop: 4, marginBottom: 20, lineHeight: 19 },
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
  infoBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  errorIcon: { fontSize: 16 },
  errorText: { flex: 1, color: '#dc2626', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  infoText: { color: '#047857' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  passwordInput: { flex: 1, paddingRight: 0 },
  eyeBtn: {
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  eyeBtnText: { color: '#0f766e', fontSize: 13, fontWeight: '700' },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rememberLabel: { color: '#475569', fontSize: 13, fontWeight: '600', flex: 1 },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.65 },
  btnPressed: { backgroundColor: '#059669' },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  forgotBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginTop: 10,
  },
  forgotText: { color: '#0f766e', fontSize: 13, fontWeight: '700' },
  helpToggle: { alignItems: 'center', marginTop: 4 },
  helpToggleText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  helpBox: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  helpTitle: { color: '#0f172a', fontSize: 13, fontWeight: '800', marginBottom: 6 },
  helpCopy: { color: '#64748b', fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
