import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiError, listAlerts, type Alert } from '../lib/api';

export function AlertsScreen({ onDone }: { onDone: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listAlerts()
      .then(setAlerts)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load alerts.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Alerts</Text>
        <Pressable onPress={onDone}>
          <Text style={styles.back}>Close</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color="#196a49" style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={styles.list}>
        {alerts.length === 0 && !loading && !error ? (
          <Text style={styles.empty}>No alerts for this shop yet.</Text>
        ) : null}
        {alerts.map((alert) => (
          <View key={alert.id} style={styles.card}>
            <Text style={styles.meta}>
              {alert.severity} · {alert.type.replace('_', ' ')}
            </Text>
            <Text style={styles.message}>{alert.message}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    backgroundColor: '#0d3427',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  back: { color: '#bce8cd', fontWeight: '700' },
  spinner: { marginTop: 24 },
  list: { padding: 24, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d7e3da',
  },
  meta: {
    color: '#196a49',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  message: { color: '#17221c', marginTop: 6, fontSize: 14, lineHeight: 20 },
  empty: { color: '#536158' },
  error: { color: '#B3261E', padding: 24 },
});
