import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/auth-provider';

export function VendorHomeScreen() {
  const { identity, signOut } = useAuth();
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>FreshLens</Text>
          <Text style={styles.context}>Vendor workspace</Text>
        </View>
        <Pressable onPress={() => void signOut()} accessibilityRole="button">
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Authenticated securely</Text>
        <Text style={styles.title}>Welcome to your produce workspace.</Text>
        <Text style={styles.copy}>
          {identity?.email ?? 'Your vendor account'} is connected to a verified tenant. Scan and inventory workflows can now use the bearer token through the API client.
        </Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Tenant isolation active</Text>
          <Text style={styles.noticeCopy}>The tenant is derived from your signed session and is never accepted from a request form.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 18, backgroundColor: '#0d3427' },
  brand: { color: '#fff', fontSize: 18, fontWeight: '800' },
  context: { color: '#a8c4b4', fontSize: 11, marginTop: 1 },
  signOut: { color: '#bce8cd', fontSize: 13, fontWeight: '700' },
  content: { padding: 24 },
  eyebrow: { color: '#196a49', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 28 },
  title: { color: '#17221c', fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -0.6, marginTop: 9 },
  copy: { color: '#536158', fontSize: 14, lineHeight: 22, marginTop: 13 },
  notice: { padding: 18, borderRadius: 15, backgroundColor: '#e8f5ed', marginTop: 28 },
  noticeTitle: { color: '#18533d', fontSize: 14, fontWeight: '800' },
  noticeCopy: { color: '#536158', fontSize: 12, lineHeight: 19, marginTop: 5 },
});
