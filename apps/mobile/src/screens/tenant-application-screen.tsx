import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitTenantApplication } from '../lib/tenant-applications';
import {
  validateTenantApplication, type TenantApplicationErrors,
  type TenantApplicationField, type TenantApplicationInput,
} from '../lib/tenant-application-validation';

const INITIAL_APPLICATION: TenantApplicationInput = {
  organization: '', name: '', email: '', phone: '',
};

export function TenantApplicationScreen({ onBackToSignIn }: {
  onBackToSignIn: () => void;
}) {
  const [application, setApplication] = useState(INITIAL_APPLICATION);
  const [errors, setErrors] = useState<TenantApplicationErrors>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: TenantApplicationField, value: string) {
    setApplication((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit() {
    const fieldErrors = validateTenantApplication(application);
    setErrors(fieldErrors);
    setSubmitError(null);
    if (Object.keys(fieldErrors).length) return;
    setPending(true);
    try {
      await submitTenantApplication(application);
      setSubmitted(true);
    } catch {
      setSubmitError('We could not submit your application. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.successPage}>
          <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
          <Text style={styles.successTitle}>Application received</Text>
          <Text style={styles.successCopy}>
            A platform administrator will review your store. If it is approved, we will email
            the owner a secure FreshLens password-setup link.
          </Text>
          <PrimaryButton label="Back to sign in" onPress={onBackToSignIn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}><Text style={styles.logoEmoji}>🌱</Text></View>
            <View>
              <Text style={styles.brandTitle}>FreshLens AI</Text>
              <Text style={styles.brandSubtitle}>Reviewed tenant onboarding</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>TENANT APPLICATION</Text>
            <Text style={styles.cardHeader}>Apply for your store</Text>
            <Text style={styles.cardSub}>
              No password is needed yet. Approval creates a private tenant workspace and sends
              the owner an invitation.
            </Text>
            {submitError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}
            <ApplicationField label="Store or organization" value={application.organization}
              onChangeText={(value) => updateField('organization', value)} error={errors.organization}
              placeholder="Example Grocer" autoComplete="organization" maxLength={120} editable={!pending} />
            <ApplicationField label="Owner name" value={application.name}
              onChangeText={(value) => updateField('name', value)} error={errors.name}
              placeholder="Your full name" autoComplete="name" maxLength={120} editable={!pending} />
            <ApplicationField label="Owner email" value={application.email}
              onChangeText={(value) => updateField('email', value)} error={errors.email}
              placeholder="owner@example.com" autoComplete="email" keyboardType="email-address"
              autoCapitalize="none" maxLength={254} editable={!pending} />
            <ApplicationField label="Phone (optional)" value={application.phone}
              onChangeText={(value) => updateField('phone', value)} error={errors.phone}
              placeholder="+94 77 123 4567" autoComplete="tel" keyboardType="phone-pad"
              maxLength={40} editable={!pending} />
            <PrimaryButton label="Submit for review" onPress={() => void submit()} pending={pending} />
            <Pressable onPress={onBackToSignIn} disabled={pending} accessibilityRole="button" style={styles.backButton}>
              <Text style={styles.backButtonText}>Already approved? Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string; value: string; onChangeText: (value: string) => void; error?: string;
  placeholder: string; autoComplete: 'organization' | 'name' | 'email' | 'tel';
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength: number; editable: boolean;
};

function ApplicationField({ label, error, ...inputProps }: FieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputWrapError]}>
        <TextInput {...inputProps} style={styles.input} autoCorrect={false}
          placeholderTextColor="#94a3b8" accessibilityLabel={label}
          accessibilityState={{ disabled: !inputProps.editable }} />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PrimaryButton({ label, onPress, pending = false }: {
  label: string; onPress: () => void; pending?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pending && styles.buttonDisabled,
      pressed && styles.buttonPressed]} onPress={onPress} disabled={pending} accessibilityRole="button">
      {pending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#047857' },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 36 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  logoBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 22 },
  brandTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  brandSubtitle: { color: '#86efac', fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  eyebrow: { color: '#047857', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  cardHeader: { color: '#0f172a', fontSize: 22, fontWeight: '800', marginTop: 5 },
  cardSub: { color: '#64748b', fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 20 },
  errorBanner: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  inputGroup: { marginBottom: 15 },
  inputLabel: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputWrap: { borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', overflow: 'hidden' },
  inputWrapError: { borderColor: '#dc2626', backgroundColor: '#fff7f7' },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, color: '#0f172a' },
  fieldError: { color: '#dc2626', fontSize: 12, marginTop: 5 },
  primaryButton: { height: 52, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  buttonPressed: { backgroundColor: '#059669' },
  backButton: { alignItems: 'center', padding: 12, marginTop: 8 },
  backButtonText: { color: '#047857', fontSize: 14, fontWeight: '700' },
  successPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  successIconText: { color: '#ffffff', fontSize: 34, fontWeight: '800' },
  successTitle: { color: '#ffffff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  successCopy: { color: '#d1fae5', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10, marginBottom: 24 },
});
