import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';

export function ScanCaptureScreen({
  onImageAccepted,
}: {
  onImageAccepted: (photo: CameraCapturedPicture) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<CameraCapturedPicture | null>(null);
  const [capturing, setCapturing] = useState(false);

  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionPage}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconCircle}>
            <Text style={styles.permissionIcon}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            FreshLens AI needs your camera to photograph fresh produce, run neural network segmentation, and compute real-time freshness indexes.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Enable Camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function takePicture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo) setPreview(photo);
    } finally {
      setCapturing(false);
    }
  }

  if (preview) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: preview.uri }} style={styles.previewImage} />
        
        {/* Preview Header Overlay */}
        <SafeAreaView style={styles.previewTopOverlay}>
          <View style={styles.previewHeaderPill}>
            <Text style={styles.previewHeaderDot}>●</Text>
            <Text style={styles.previewHeaderText}>Photo Captured</Text>
          </View>
        </SafeAreaView>

        {/* Action Controls */}
        <View style={styles.previewActionCard}>
          <Text style={styles.previewPrompt}>Is the produce clearly in focus?</Text>
          <View style={styles.previewButtonsRow}>
            <Pressable
              style={styles.retakeBtn}
              onPress={() => setPreview(null)}
              accessibilityRole="button"
            >
              <Text style={styles.retakeBtnText}>Retake</Text>
            </Pressable>
            <Pressable
              style={styles.usePhotoBtn}
              onPress={() => onImageAccepted(preview)}
              accessibilityRole="button"
            >
              <Text style={styles.usePhotoBtnText}>Use Photo →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Top Header HUD */}
        <SafeAreaView style={styles.topHud}>
          <View style={styles.hudBadge}>
            <View style={styles.aiLiveDot} />
            <Text style={styles.hudBadgeText}>YOLO AI Viewfinder</Text>
          </View>
          <Text style={styles.hudHint}>Frame 1 product in the center box</Text>
        </SafeAreaView>

        {/* Viewfinder Target Framing Box with Corner Brackets */}
        <View style={styles.viewfinderCenter}>
          <View style={styles.targetFrame}>
            {/* 4 Corner Brackets */}
            <View style={[styles.cornerBracket, styles.topLeft]} />
            <View style={[styles.cornerBracket, styles.topRight]} />
            <View style={[styles.cornerBracket, styles.bottomLeft]} />
            <View style={[styles.cornerBracket, styles.bottomRight]} />
            
            {/* Center Reticle Crosshair */}
            <View style={styles.reticleCrosshair}>
              <View style={styles.reticleHorizontal} />
              <View style={styles.reticleVertical} />
            </View>

            <Text style={styles.targetLabel}>ALIGN PRODUCE</Text>
          </View>
        </View>

        {/* Bottom Shutter Controls */}
        <View style={styles.bottomHud}>
          <Text style={styles.lightingTip}>💡 Ensure natural lighting for best accuracy</Text>
          <View style={styles.shutterRow}>
            <Pressable
              style={({ pressed }) => [
                styles.shutterOuter,
                pressed && styles.shutterOuterPressed,
              ]}
              onPress={() => void takePicture()}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
            >
              {capturing ? (
                <ActivityIndicator color="#0d3427" size="small" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a1d15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionPage: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e6f4ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionIcon: { fontSize: 32 },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  camera: { flex: 1, justifyContent: 'space-between' },
  topHud: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 8,
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 8,
  },
  aiLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  hudBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  hudHint: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewfinderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetFrame: {
    width: 270,
    height: 270,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#10b981',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 10,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 10,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 10,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 10,
  },
  reticleCrosshair: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleHorizontal: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.6)',
  },
  reticleVertical: {
    position: 'absolute',
    height: 20,
    width: 1.5,
    backgroundColor: 'rgba(16, 185, 129, 0.6)',
  },
  targetLabel: {
    position: 'absolute',
    bottom: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  bottomHud: {
    paddingBottom: 36,
    alignItems: 'center',
    gap: 16,
  },
  lightingTip: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
  },
  previewContainer: { flex: 1, backgroundColor: '#090d0b' },
  previewImage: { flex: 1, resizeMode: 'cover' },
  previewTopOverlay: {
    position: 'absolute',
    top: 10,
    width: '100%',
    alignItems: 'center',
  },
  previewHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  previewHeaderDot: { color: '#10b981', fontSize: 10 },
  previewHeaderText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  previewActionCard: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  previewPrompt: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  previewButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  retakeBtnText: { color: '#64748b', fontSize: 15, fontWeight: '700' },
  usePhotoBtn: {
    flex: 1.5,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: '#10b981',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  usePhotoBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});

