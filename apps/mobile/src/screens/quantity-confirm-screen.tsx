import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  const [quantityText, setQuantityText] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
      <Text style={styles.label}>How many units?</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="e.g. 12"
        value={quantityText}
        onChangeText={(text) => {
          setQuantityText(text);
          if (error) setError(null);
        }}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Retake Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleConfirm}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  thumbnail: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#eee',
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#222' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 14,
    fontSize: 20,
    marginBottom: 8,
  },
  error: { color: '#B3261E', fontSize: 14, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#333', fontSize: 15, fontWeight: '600' },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#196a49',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
