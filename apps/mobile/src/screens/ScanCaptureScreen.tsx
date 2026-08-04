import { useRef, useState } from 'react';
import { Button, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';

export default function ScanCaptureScreen({
  onImageAccepted,
}: {
  onImageAccepted: (photo: CameraCapturedPicture) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<CameraCapturedPicture | null>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          FreshLens needs camera access to scan produce.
        </Text>
        <Button onPress={requestPermission} title="Grant Camera Permission" />
      </View>
    );
  }

  async function takePicture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    setPreview(photo);
  }

  function retake() {
    setPreview(null);
  }

  function accept() {
    if (preview) onImageAccepted(preview);
  }

  if (preview) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: preview.uri }} style={styles.previewImage} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={retake}>
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={accept}>
            <Text style={styles.primaryButtonText}>Use This Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.captureBar}>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Photograph one product at a time</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  message: {
    textAlign: 'center',
    color: '#333',
    fontSize: 15,
    margin: 24,
  },
  camera: { flex: 1 },
  captureBar: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  hint: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  previewImage: { flex: 1, resizeMode: 'contain', backgroundColor: '#000' },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#111',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  secondaryButtonText: { color: '#fff', fontSize: 16 },
  primaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
