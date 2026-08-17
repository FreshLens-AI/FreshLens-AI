import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CameraCapturedPicture } from 'expo-camera';

export function QuantityConfirmScreen({
  photo,
  onConfirm,
  onBack,
}: {
  photo: CameraCapturedPicture;
  onConfirm: (quantity: number) => void;
  onBack: () => void;
}) {
  const [quantityText, setQuantityText] = useState('1');
  const [error, setError] = useState<string | null>(null);

  function adjustQuantity(delta: number) {
    const current = parseInt(quantityText, 10) || 1;
    const next = Math.max(1, Math.min(999, current + delta));
    setQuantityText(String(next));
    if (error) setError(null);
  }

  function handleConfirm() {
    const trimmed = quantityText.trim();
    if (!trimmed) {
      setError('Enter a quantity before continuing.');
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setError('Quantity must be a whole number.');
      return;
    }
    const parsed = Number(trimmed);
    if (parsed < 1) {
      setError('Quantity must be at least 1.');
      return;
    }
    setError(null);
    onConfirm(parsed);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Confirm Scan Batch</Text>
          <Text style={styles.topBarSub}>Step 2 of 2 · AI Freshness Analysis</Text>
        </View>

        {/* Photo Preview Card */}
        <View style={styles.photoContainer}>
          <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>📸 Captured Produce</Text>
          </View>
        </View>

        {/* Quantity Selection Card */}
        <View style={styles.card}>
          <Text style={styles.label}>How many items in this batch?</Text>
          <Text style={styles.subLabel}>
            The AI model will classify individual freshness across this batch count.
          </Text>

          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => adjustQuantity(-1)}
              accessibilityRole="button"
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={quantityText}
              onChangeText={(text) => {
                setQuantityText(text);
                if (error) setError(null);
              }}
              selectTextOnFocus
            />
            <Pressable
              style={styles.stepBtn}
              onPress={() => adjustQuantity(1)}
              accessibilityRole="button"
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>

          {/* Quick preset chips */}
          <View style={styles.chipsRow}>
            {[1, 2, 5, 10, 20, 50].map((num) => (
              <Pressable
                key={num}
                style={[
                  styles.chip,
                  quantityText === String(num) && styles.chipActive,
                ]}
                onPress={() => {
                  setQuantityText(String(num));
                  if (error) setError(null);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    quantityText === String(num) && styles.chipTextActive,
                  ]}
                >
                  {num}
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={onBack}>
            <Text style={styles.secondaryButtonText}>Retake Photo</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={handleConfirm}>
            <Text style={styles.primaryButtonText}>Analyze Freshness →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f4' },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  topBar: {
    paddingTop: 10,
    marginBottom: 4,
  },
  topBarTitle: { color: '#17221c', fontSize: 22, fontWeight: '800' },
  topBarSub: { color: '#627067', fontSize: 13, marginTop: 2 },
  photoContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  photoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#d7e3da',
    alignItems: 'center',
    gap: 12,
  },
  label: { fontSize: 17, fontWeight: '800', color: '#17221c', textAlign: 'center' },
  subLabel: {
    fontSize: 12,
    color: '#627067',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 6,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#196a49', fontSize: 24, fontWeight: '800' },
  input: {
    width: 100,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#196a49',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#17221c',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f0f4f1',
  },
  chipActive: {
    backgroundColor: '#196a49',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: '#536158' },
  chipTextActive: { color: '#fff' },
  errorBox: {
    backgroundColor: '#ffebe9',
    borderRadius: 8,
    padding: 8,
    width: '100%',
    alignItems: 'center',
  },
  errorText: { color: '#ba1a1a', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  secondaryButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e3da',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#536158', fontSize: 15, fontWeight: '700' },
  primaryButton: {
    flex: 1.4,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#196a49',
    alignItems: 'center',
    shadowColor: '#196a49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

