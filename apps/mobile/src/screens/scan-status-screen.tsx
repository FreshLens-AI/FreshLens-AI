import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ApiError, getScan, type Scan } from '../lib/api';

const POLL_INTERVAL_MS = 2000;

export function ScanStatusScreen({
  scanId,
  onDone,
}: {
  scanId: string;
  onDone: () => void;
}) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const result = await getScan(scanId);
        setScan(result);
        setError(null);
        if (result.status === 'completed' || result.status === 'failed') {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Could not check scan status.',
        );
      }
    }

    void poll();
    timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scanId]);

  if (error && !scan) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!scan) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#196a49" />
        <Text style={styles.hint}>Checking scan status…</Text>
      </View>
    );
  }

  const isDone = scan.status === 'completed' || scan.status === 'failed';

  return (
    <View style={styles.container}>
      {!isDone ? <ActivityIndicator size="large" color="#196a49" /> : null}
      <Text style={styles.status}>Status: {scan.status}</Text>

      {scan.status === 'completed' ? (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>Classification</Text>
          <Text style={styles.resultValue}>{scan.classification ?? '—'}</Text>
          <Text style={styles.resultLabel}>Confidence</Text>
          <Text style={styles.resultValue}>
            {scan.freshness_score != null
              ? `${Math.round(scan.freshness_score * 100)}%`
              : '—'}
          </Text>
        </View>
      ) : null}

      {scan.status === 'failed' ? (
        <Text style={styles.error}>Classification failed for this scan.</Text>
      ) : null}

      {isDone ? (
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Back to home</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#f4f7f4',
  },
  hint: { fontSize: 14, color: '#666' },
  status: { fontSize: 18, fontWeight: '600', color: '#222' },
  result: { alignItems: 'center', gap: 4, marginTop: 8 },
  resultLabel: { fontSize: 13, color: '#777', marginTop: 8 },
  resultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#196a49',
    textTransform: 'capitalize',
  },
  error: { color: '#B3261E', fontSize: 15, textAlign: 'center' },
  button: {
    marginTop: 16,
    backgroundColor: '#196a49',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
