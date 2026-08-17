import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
  listScans,
  parseIdentifiedProduce,
  type Classification,
  type Scan,
} from '../lib/api';

type Filter = 'all' | 'fresh' | 'medium' | 'spoiled';

export function ScanHistoryScreen({ onDone }: { onDone: () => void }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchScans = useCallback(async () => {
    try {
      const res = await listScans(50, 0);
      setScans(res.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load scan history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchScans();
  }, [fetchScans]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchScans();
  }, [fetchScans]);

  const filteredScans = scans.filter((s) => {
    if (filter === 'all') return true;
    return s.classification === filter;
  });

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Scan History</Text>
          <Text style={styles.headerSubtitle}>
            {scans.length} total AI inspection{scans.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable onPress={onDone} style={styles.closeButton} accessibilityRole="button">
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'fresh', 'medium', 'spoiled'] as Filter[]).map((f) => {
          const count =
            f === 'all'
              ? scans.length
              : scans.filter((s) => s.classification === f).length;
          const active = filter === f;
          return (
            <Pressable
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#196a49" />
          <Text style={styles.loadingText}>Loading inspection records…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchScans}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#196a49"
              colors={['#196a49']}
            />
          }
        >
          {filteredScans.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No scans in this filter</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all'
                  ? 'Start scanning produce using the camera to populate your inspection history.'
                  : `No scans classified as ${filter} yet.`}
              </Text>
            </View>
          ) : (
            filteredScans.map((item) => {
              const produceName = parseIdentifiedProduce(item.model_version);
              const emoji = getProduceEmoji(produceName);
              const badge = getFreshnessBadge(item.classification as Classification | null);
              const formattedDate = new Date(item.created_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.produceInfo}>
                      <Text style={styles.produceEmoji}>{emoji}</Text>
                      <View>
                        <Text style={styles.produceName}>
                          {produceName || 'Standard Produce'}
                        </Text>
                        <Text style={styles.timestamp}>{formattedDate}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: badge.badgeBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: badge.badgeColor },
                        ]}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Quantity</Text>
                      <Text style={styles.metaValue}>{item.quantity} units</Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Confidence</Text>
                      <Text style={styles.metaValue}>
                        {item.freshness_score != null
                          ? `${Math.round(item.freshness_score * 100)}%`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.metaLabel}>Status</Text>
                      <Text
                        style={[
                          styles.metaValue,
                          item.status === 'completed'
                            ? styles.statusCompleted
                            : item.status === 'failed'
                            ? styles.statusFailed
                            : styles.statusProcessing,
                        ]}
                      >
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {item.model_version ? (
                    <View style={styles.modelPill}>
                      <Text style={styles.modelPillText}>
                        Model: {item.model_version}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0d3427',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  headerSubtitle: { color: '#a8c4b4', fontSize: 12, marginTop: 2 },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  closeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e3ebe5',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#edf2ee',
  },
  filterChipActive: {
    backgroundColor: '#196a49',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#536158',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#536158',
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#196a49',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3ebe5',
    marginTop: 20,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#17221c' },
  emptySubtitle: {
    fontSize: 13,
    color: '#627067',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d7e3da',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  produceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  produceEmoji: { fontSize: 32 },
  produceName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#17221c',
    textTransform: 'capitalize',
  },
  timestamp: {
    fontSize: 12,
    color: '#849188',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f0f4f1',
    marginVertical: 12,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 11,
    color: '#849188',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17221c',
    marginTop: 2,
  },
  statusCompleted: { color: '#196a49' },
  statusProcessing: { color: '#c47d00' },
  statusFailed: { color: '#ba1a1a' },
  modelPill: {
    marginTop: 10,
    backgroundColor: '#f4f7f4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  modelPillText: {
    fontSize: 11,
    color: '#627067',
    fontWeight: '600',
  },
});
