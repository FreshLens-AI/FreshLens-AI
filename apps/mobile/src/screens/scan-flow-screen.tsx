import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CameraCapturedPicture } from 'expo-camera';

import { ApiError, submitScan } from '../lib/api';
import { QuantityConfirmScreen } from './quantity-confirm-screen';
import { ScanCaptureScreen } from './scan-capture-screen';
import { ScanStatusScreen } from './scan-status-screen';

type Step =
  | { name: 'capture' }
  | { name: 'confirm'; photo: CameraCapturedPicture }
  | { name: 'submitting'; photo: CameraCapturedPicture; quantity: number }
  | { name: 'status'; scanId: string };

export function ScanFlowScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'capture' });

  if (step.name === 'capture') {
    return (
      <ScanCaptureScreen
        onImageAccepted={(photo) => setStep({ name: 'confirm', photo })}
      />
    );
  }

  if (step.name === 'confirm') {
    return (
      <QuantityConfirmScreen
        photo={step.photo}
        onBack={() => setStep({ name: 'capture' })}
        onConfirm={(quantity) => {
          const photo = step.photo;
          setStep({ name: 'submitting', photo, quantity });
          void (async () => {
            try {
              const accepted = await submitScan(photo.uri, quantity);
              setStep({ name: 'status', scanId: accepted.id });
            } catch (err) {
              const message =
                err instanceof ApiError
                  ? err.message
                  : 'Could not submit scan. The scan API may not be available yet — check your connection and try again.';
              Alert.alert('Scan submission failed', message, [
                {
                  text: 'Retry',
                  onPress: () => setStep({ name: 'confirm', photo }),
                },
                { text: 'Cancel', style: 'cancel', onPress: onDone },
              ]);
              setStep({ name: 'confirm', photo });
            }
          })();
        }}
      />
    );
  }

  if (step.name === 'submitting') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#196a49" />
        <Text style={styles.hint}>Submitting scan…</Text>
      </View>
    );
  }

  return <ScanStatusScreen scanId={step.scanId} onDone={onDone} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f4f7f4',
  },
  hint: { fontSize: 14, color: '#666' },
});
