import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  ApiError,
  getFreshnessBadge,
  getProduceEmoji,
  getScan,
  parseIdentifiedProduce,
  type Scan,
} from '../lib/api';

const POLL_INTERVAL_MS = 1800;

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
      <SafeAreaView style={styles.page}>
        <View style={styles.centerContainer}>
          <View style={styles.errorIconCircle}>
            <Text style={styles.errorIcon}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>Inspection Check Failed</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={onDone}>
            <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!scan || scan.status === 'pending' || scan.status === 'processing') {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.centerContainer}>
          <View style={styles.loadingCircle}>
            <ActivityIndicator size="large" color="#196a49" />
          </View>
          <Text style={styles.loadingTitle}>Processing AI Inspection…</Text>
          <Text style={styles.loadingSubtitle}>
            Image is queued for YOLO classification & freshness analysis.
          </Text>

          <View style={styles.stepsCard}>
            <View style={styles.stepRow}>
              <Text style={styles.stepCheck}>✓</Text>
              <Text style={styles.stepText}>Image uploaded to secure storage</Text>
            </View>
            <View style={styles.stepRow}>
              <ActivityIndicator size="small" color="#196a49" style={{ marginRight: 4 }} />
              <Text style={[styles.stepText, { fontWeight: '700', color: '#196a49' }]}>
                Running produce neural network…
              </Text>
            </View>
            <View style={styles.stepRow}>
              <Text style={styles.stepPending}>○</Text>
              <Text style={[styles.stepText, { color: '#849188' }]}>
                Computing batch freshness confidence
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const produce = parseIdentifiedProduce(scan.model_version);
  const emoji = getProduceEmoji(produce);
  const badge = getFreshnessBadge(scan.classification);
  const confidencePct =
    scan.freshness_score != null ? Math.round(scan.freshness_score * 100) : null;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Inspection Result</Text>
          <View
            style={[
              styles.statusPill,
              scan.status === 'completed'
                ? styles.statusPillCompleted
                : styles.statusPillFailed,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                scan.status === 'completed'
                  ? styles.statusPillTextCompleted
                  : styles.statusPillTextFailed,
              ]}
            >
              {scan.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {scan.status === 'completed' ? (
          <>
            {/* Primary Result Card */}
            <View style={styles.resultCard}>
              <View style={styles.produceRow}>
                <View style={styles.produceEmojiCircle}>
                  <Text style={styles.produceEmojiText}>{emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.produceSub}>Identified Produce</Text>
                  <Text style={styles.produceNameText}>{produce}</Text>
                </View>
                <View
                  style={[
                    styles.freshnessBadge,
                    { backgroundColor: badge.badgeBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.freshnessBadgeText,
                      { color: badge.badgeColor },
                    ]}
                  >
                    {badge.label}
                  </Text>
                </View>
              </View>

              {/* Confidence Gauge */}
              {confidencePct != null ? (
                <View style={styles.gaugeContainer}>
                  <View style={styles.gaugeHeader}>
                    <Text style={styles.gaugeLabel}>Freshness Confidence</Text>
                    <Text style={styles.gaugeValue}>{confidencePct}%</Text>
                  </View>
                  <View style={styles.gaugeTrack}>
                    <View
                      style={[
                        styles.gaugeFill,
                        {
                          width: `${Math.min(100, Math.max(5, confidencePct))}%`,
                          backgroundColor:
                            scan.classification === 'fresh'
                              ? '#196a49'
                              : scan.classification === 'medium'
                              ? '#c47d00'
                              : '#ba1a1a',
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {/* Inspection Details Card */}
            <View style={styles.detailsCard}>
              <Text style={styles.detailsHeader}>Batch & Scan Metadata</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Batch Quantity</Text>
                <Text style={styles.detailVal}>{scan.quantity} units</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Scan ID</Text>
                <Text style={styles.detailVal}>{scan.id.slice(0, 13)}…</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Model Version</Text>
                <Text style={styles.detailVal}>{scan.model_version || 'yolo26-cls'}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Timestamp</Text>
                <Text style={styles.detailVal}>
                  {new Date(scan.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.failedCard}>
            <Text style={styles.failedTitle}>Classification Incomplete</Text>
            <Text style={styles.failedCopy}>
              The AI classifier was unable to determine freshness for this photo. Please retake with clear lighting.
            </Text>
          </View>
        )}

        <Pressable style={styles.primaryBtn} onPress={onDone}>
          <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingTitle: { color: '#17221c', fontSize: 20, fontWeight: '800' },
  loadingSubtitle: {
    color: '#627067',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#d7e3da',
    gap: 14,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepCheck: { color: '#196a49', fontWeight: '900', fontSize: 15 },
  stepPending: { color: '#849188', fontSize: 13 },
  stepText: { color: '#17221c', fontSize: 13, fontWeight: '500' },
  errorIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffebe9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIcon: { fontSize: 32 },
  errorTitle: { color: '#17221c', fontSize: 20, fontWeight: '800' },
  errorSubtitle: { color: '#ba1a1a', fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerTitle: { color: '#17221c', fontSize: 24, fontWeight: '800' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillCompleted: { backgroundColor: '#e8f5ed' },
  statusPillFailed: { backgroundColor: '#ffebe9' },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statusPillTextCompleted: { color: '#196a49' },
  statusPillTextFailed: { color: '#ba1a1a' },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#d7e3da',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 16,
  },
  produceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  produceEmojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f4f7f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  produceEmojiText: { fontSize: 28 },
  produceSub: { color: '#849188', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  produceNameText: { color: '#17221c', fontSize: 19, fontWeight: '800', textTransform: 'capitalize', marginTop: 2 },
  freshnessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  freshnessBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  gaugeContainer: {
    backgroundColor: '#f9fbf9',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8f0eb',
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gaugeLabel: { color: '#627067', fontSize: 12, fontWeight: '700' },
  gaugeValue: { color: '#17221c', fontSize: 13, fontWeight: '800' },
  gaugeTrack: {
    height: 10,
    backgroundColor: '#e3ebe5',
    borderRadius: 5,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 5,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#d7e3da',
    gap: 10,
  },
  detailsHeader: { color: '#18533d', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { color: '#849188', fontSize: 13, fontWeight: '600' },
  detailVal: { color: '#17221c', fontSize: 13, fontWeight: '700' },
  detailDivider: { height: 1, backgroundColor: '#f0f4f1' },
  failedCard: {
    backgroundColor: '#ffebe9',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#ba1a1a',
    gap: 6,
  },
  failedTitle: { color: '#ba1a1a', fontSize: 16, fontWeight: '800' },
  failedCopy: { color: '#536158', fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#196a49',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#196a49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

