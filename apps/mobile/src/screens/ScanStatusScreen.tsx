import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getScan, type Scan, ApiError } from '../lib/api';

const POLL_INTERVAL_MS = 2000;

// FR-V-05 View Scan Result Status
export default function ScanStatusScreen({
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
        // UR-05: keep this non-technical; ApiError.message comes from the
        // API's `detail` field, which is already meant to be readable.
        setError(err instanceof ApiError ? err.message : 'Could not check scan status.');
      }
    }

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [scanId]);

  if (error && !scan) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!scan) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.hint}>Checking scan status…</Text>
      </View>
    );
  }

  const isDone = scan.status === 'completed' || scan.status === 'failed';

  return (
    <View style={styles.container}>
      {!isDone && <ActivityIndicator size="large" color="#2E7D32" />}
      <Text style={styles.status}>Status: {scan.status}</Text>

      {scan.status === 'completed' && (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>Classification</Text>
          <Text style={styles.resultValue}>{scan.classification ?? '—'}</Text>
          <Text style={styles.resultLabel}>Confidence</Text>
          <Text style={styles.resultValue}>
            {scan.freshness_score != null ? `${Math.round(scan.freshness_score * 100)}%` : '—'}
          </Text>
        </View>
      )}

      {scan.status === 'failed' && (
        <Text style={styles.error}>Classification failed for this scan.</Text>
      )}

      {isDone && (
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  hint: { fontSize: 14, color: '#666' },
  status: { fontSize: 18, fontWeight: '600', color: '#222' },
  result: { alignItems: 'center', gap: 4, marginTop: 8 },
  resultLabel: { fontSize: 13, color: '#777', marginTop: 8 },
  resultValue: { fontSize: 20, fontWeight: '700', color: '#2E7D32', textTransform: 'capitalize' },
  error: { color: '#B3261E', fontSize: 15, textAlign: 'center' },
  button: {
    marginTop: 16,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
