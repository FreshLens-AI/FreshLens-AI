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

import { ApiError, listAlerts, type Alert } from '../lib/api';

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

export function AlertsScreen({ onDone }: { onDone: () => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await listAlerts();
      setAlerts(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Could not load alerts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchAlerts();
  }, [fetchAlerts]);

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'all') return true;
    return a.severity === filter;
  });

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Inventory & Quality Alerts</Text>
          <Text style={styles.headerSub}>{alerts.length} active notifications</Text>
        </View>
        <Pressable onPress={onDone} style={styles.closeBtn} accessibilityRole="button">
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map((tab) => {
          const active = filter === tab;
          const count =
            tab === 'all'
              ? alerts.length
              : alerts.filter((a) => a.severity === tab).length;
          return (
            <Pressable
              key={tab}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(tab)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#196a49" />
          <Text style={styles.loadingText}>Fetching active alerts…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchAlerts}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#196a49"
              colors={['#196a49']}
            />
          }
        >
          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🎉</Text>
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all'
                  ? 'No inventory or spoilage alerts for your shop.'
                  : `No ${filter} alerts found.`}
              </Text>
            </View>
          ) : (
            filteredAlerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isWarn = alert.severity === 'warning';
              const icon = isCrit ? '🚨' : isWarn ? '⚠️' : 'ℹ️';

              return (
                <View
                  key={alert.id}
                  style={[
                    styles.card,
                    isCrit && styles.cardCritical,
                    isWarn && styles.cardWarning,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.typeRow}>
                      <Text style={styles.alertIcon}>{icon}</Text>
                      <Text
                        style={[
                          styles.typeText,
                          isCrit && styles.typeCritical,
                          isWarn && styles.typeWarning,
                        ]}
                      >
                        {alert.type.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.severityPill,
                        isCrit
                          ? styles.sevPillCrit
                          : isWarn
                          ? styles.sevPillWarn
                          : styles.sevPillInfo,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sevText,
                          isCrit
                            ? styles.sevTextCrit
                            : isWarn
                            ? styles.sevTextWarn
                            : styles.sevTextInfo,
                        ]}
                      >
                        {alert.severity}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.message}>{alert.message}</Text>
                  <Text style={styles.timestamp}>
                    {new Date(alert.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#a8c4b4', fontSize: 11, marginTop: 2 },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  closeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  filterChipActive: { backgroundColor: '#196a49' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#536158' },
  filterChipTextActive: { color: '#fff' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: '#536158', fontSize: 13, marginTop: 12 },
  errorText: { color: '#ba1a1a', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#196a49',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d7e3da',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  cardCritical: {
    borderColor: '#ffb4a9',
    backgroundColor: '#fffbfa',
  },
  cardWarning: {
    borderColor: '#ffe082',
    backgroundColor: '#fffdf5',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertIcon: { fontSize: 16 },
  typeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#196a49',
  },
  typeCritical: { color: '#ba1a1a' },
  typeWarning: { color: '#c47d00' },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sevPillCrit: { backgroundColor: '#ffebe9' },
  sevPillWarn: { backgroundColor: '#fff3e0' },
  sevPillInfo: { backgroundColor: '#e8f0fe' },
  sevText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sevTextCrit: { color: '#ba1a1a' },
  sevTextWarn: { color: '#c47d00' },
  sevTextInfo: { color: '#1a73e8' },
  message: { color: '#17221c', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  timestamp: { color: '#849188', fontSize: 11, marginTop: 4 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7e3da',
    marginTop: 20,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#17221c' },
  emptySubtitle: {
    fontSize: 13,
    color: '#627067',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

