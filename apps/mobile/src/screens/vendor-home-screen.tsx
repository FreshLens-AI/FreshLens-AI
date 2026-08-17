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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/auth-provider';
import { listAlerts, listProducts, listScans } from '../lib/api';
import type { VendorStackParamList } from '../navigation/vendor-navigator';

type Props = NativeStackScreenProps<VendorStackParamList, 'Home'>;

export function VendorHomeScreen({ navigation }: Props) {
  const { identity, signOut } = useAuth();
  const [stats, setStats] = useState({
    products: 0,
    alerts: 0,
    scans: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [productsRes, alertsRes, scansRes] = await Promise.allSettled([
        listProducts(),
        listAlerts(),
        listScans(10, 0),
      ]);
      setStats({
        products: productsRes.status === 'fulfilled' ? productsRes.value.length : 0,
        alerts: alertsRes.status === 'fulfilled' ? alertsRes.value.length : 0,
        scans: scansRes.status === 'fulfilled' ? scansRes.value.total ?? scansRes.value.items.length : 0,
      });
    } catch {
      // Keep existing stats on failure
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadStats();
  }, [loadStats]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerBrandRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🌱</Text>
          </View>
          <View>
            <Text style={styles.brand}>FreshLens AI</Text>
            <Text style={styles.context}>Smart Produce & Inventory</Text>
          </View>
        </View>
        <Pressable
          onPress={() => void signOut()}
          style={styles.signOutButton}
          accessibilityRole="button"
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#196a49"
            colors={['#196a49']}
          />
        }
      >
        {/* Welcome Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Connected</Text>
            </View>
            <Text style={styles.tenantPill}>Example Grocer</Text>
          </View>
          <Text style={styles.heroTitle}>Produce Dashboard</Text>
          <Text style={styles.heroCopy}>
            Logged in as{' '}
            <Text style={styles.heroHighlight}>
              {identity?.email ? identity.email.split('@')[0] : 'Vendor'}
            </Text>
          </Text>

          {/* Quick Metrics Bar */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats.products}</Text>
              <Text style={styles.metricLabel}>Products</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{stats.scans}</Text>
              <Text style={styles.metricLabel}>AI Scans</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, stats.alerts > 0 && styles.metricAlert]}>
                {stats.alerts}
              </Text>
              <Text style={styles.metricLabel}>Alerts</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Quick Actions</Text>

        {/* Primary Action: AI Camera Scan */}
        <Pressable
          style={styles.primaryActionCard}
          onPress={() => navigation.navigate('Scan')}
          accessibilityRole="button"
        >
          <View style={styles.actionIconCircle}>
            <Text style={styles.actionIconEmoji}>📷</Text>
          </View>
          <View style={styles.actionTextCol}>
            <View style={styles.actionTitleRow}>
              <Text style={styles.primaryActionTitle}>Scan Produce</Text>
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>YOLO AI</Text>
              </View>
            </View>
            <Text style={styles.primaryActionSubtitle}>
              Photograph produce to inspect freshness score & classification
            </Text>
          </View>
          <Text style={styles.chevronPrimary}>›</Text>
        </Pressable>

        {/* Secondary Actions Grid */}
        <View style={styles.actionsGrid}>
          <Pressable
            style={styles.gridCard}
            onPress={() => navigation.navigate('Sale')}
            accessibilityRole="button"
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#eef6f0' }]}>
              <Text style={styles.gridIconEmoji}>🛒</Text>
            </View>
            <Text style={styles.gridCardTitle}>Record Sale</Text>
            <Text style={styles.gridCardSubtitle}>
              Deduct inventory batch stock in real-time
            </Text>
          </Pressable>

          <Pressable
            style={styles.gridCard}
            onPress={() => navigation.navigate('Alerts')}
            accessibilityRole="button"
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#fff3e0' }]}>
              <Text style={styles.gridIconEmoji}>⚠️</Text>
            </View>
            <View style={styles.badgeRow}>
              <Text style={styles.gridCardTitle}>Active Alerts</Text>
              {stats.alerts > 0 ? (
                <View style={styles.alertBadgePill}>
                  <Text style={styles.alertBadgeText}>{stats.alerts}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.gridCardSubtitle}>
              Spoilage warnings & low stock thresholds
            </Text>
          </Pressable>
        </View>

        {/* Full-width Scan History Link */}
        <Pressable
          style={styles.historyCard}
          onPress={() => navigation.navigate('History')}
          accessibilityRole="button"
        >
          <View style={[styles.gridIconCircle, { backgroundColor: '#e8f0fe' }]}>
            <Text style={styles.gridIconEmoji}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.historyCardTitle}>Scan History & Logs</Text>
            <Text style={styles.historyCardSubtitle}>
              View past classification results, dates & confidence scores
            </Text>
          </View>
          <Text style={styles.chevronSecondary}>›</Text>
        </Pressable>

        {/* Security & Tenant Footer Notice */}
        <View style={styles.footerCard}>
          <Text style={styles.footerIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerTitle}>Tenant Isolation Verified</Text>
            <Text style={styles.footerCopy}>
              Signed vendor session is scoped to Example Grocer database partition.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#0d3427',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 20 },
  brand: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  context: { color: '#a8c4b4', fontSize: 11, fontWeight: '500' },
  signOutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  signOut: { color: '#d4ebd9', fontSize: 12, fontWeight: '700' },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#0f3d2e',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(126, 217, 164, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#7ed9a4',
  },
  onlineText: { color: '#7ed9a4', fontSize: 11, fontWeight: '700' },
  tenantPill: {
    color: '#a8c4b4',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroCopy: { color: '#b2cebe', fontSize: 13, marginTop: 4 },
  heroHighlight: { color: '#7ed9a4', fontWeight: '700' },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricItem: { alignItems: 'center' },
  metricValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  metricAlert: { color: '#ffb4a9' },
  metricLabel: { color: '#8fb8a2', fontSize: 11, fontWeight: '600', marginTop: 2 },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sectionHeader: {
    color: '#17221c',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  primaryActionCard: {
    backgroundColor: '#196a49',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#196a49',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconEmoji: { fontSize: 24 },
  actionTextCol: { flex: 1 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryActionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  aiTag: {
    backgroundColor: '#7ed9a4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTagText: { color: '#0d3427', fontSize: 10, fontWeight: '800' },
  primaryActionSubtitle: {
    color: '#c9e8d4',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  chevronPrimary: { color: '#fff', fontSize: 26, fontWeight: '300' },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
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
  },
  gridIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridIconEmoji: { fontSize: 20 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridCardTitle: {
    color: '#17221c',
    fontSize: 15,
    fontWeight: '800',
  },
  alertBadgePill: {
    backgroundColor: '#ba1a1a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  alertBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  gridCardSubtitle: {
    color: '#627067',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#d7e3da',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  historyCardTitle: { color: '#17221c', fontSize: 15, fontWeight: '800' },
  historyCardSubtitle: { color: '#627067', fontSize: 11, marginTop: 2 },
  chevronSecondary: { color: '#849188', fontSize: 22, fontWeight: '300' },
  footerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#e8f5ed',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  footerIcon: { fontSize: 18 },
  footerTitle: { color: '#18533d', fontSize: 12, fontWeight: '800' },
  footerCopy: { color: '#536158', fontSize: 11, lineHeight: 15, marginTop: 2 },
});

