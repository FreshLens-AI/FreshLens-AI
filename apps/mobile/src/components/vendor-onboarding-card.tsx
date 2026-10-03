import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authPreferences } from '../lib/auth/secure-storage';

const STEPS = [
  'Scan a piece of produce to get a freshness score',
  'Record a sale and pick the batch to deduct stock',
  'Check alerts for spoilage and low stock',
] as const;

interface Props {
  userId: string;
  onNavigateScan: () => void;
  onNavigateSale: () => void;
  onNavigateAlerts: () => void;
}

export function VendorOnboardingCard({
  userId,
  onNavigateScan,
  onNavigateSale,
  onNavigateAlerts,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dismissed = await authPreferences.isOnboardingDismissed(userId);
      if (!cancelled) setVisible(!dismissed);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!visible) return null;

  async function dismiss() {
    setVisible(false);
    await authPreferences.dismissOnboarding(userId);
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Welcome to FreshLens</Text>
        <Pressable onPress={() => void dismiss()} accessibilityRole="button">
          <Text style={styles.dismiss}>Got it</Text>
        </Pressable>
      </View>
      <Text style={styles.copy}>
        Your account is ready. Start with these three vendor workflows:
      </Text>
      {STEPS.map((step, index) => (
        <Pressable
          key={step}
          style={styles.stepRow}
          onPress={() => {
            if (index === 0) onNavigateScan();
            else if (index === 1) onNavigateSale();
            else onNavigateAlerts();
          }}
          accessibilityRole="button"
        >
          <View style={styles.stepBadge}>
            <Text style={styles.stepNum}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0d3427',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  dismiss: { color: '#86efac', fontSize: 13, fontWeight: '700' },
  copy: { color: '#b8d0c2', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepText: { flex: 1, color: '#e8f5ef', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  chevron: { color: '#86efac', fontSize: 20, fontWeight: '300' },
});
