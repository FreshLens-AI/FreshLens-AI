import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  createVoiceSaleDraft,
  getProduceEmoji,
  listBatches,
  listProducts,
  submitSale,
  type BatchSummary,
  type ProductSummary,
  type Sale,
} from '../lib/api';
import {
  VOICE_LANGUAGES,
  buildSaleItems,
  linesFromDraft,
  pickDefaultBatch,
  speechUnavailableReason,
  validateLines,
  type DraftLine,
} from '../lib/voice-sale';

type LanguageCode = (typeof VOICE_LANGUAGES)[number]['code'];

function recognitionAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function VoiceSaleScreen({
  onDone,
  onManual,
}: {
  onDone: () => void;
  onManual: () => void;
}) {
  const [language, setLanguage] = useState<LanguageCode>('en-US');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [batchesByProduct, setBatchesByProduct] = useState<Record<string, BatchSummary[]>>({});
  const [lines, setLines] = useState<DraftLine[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  const idempotencyKey = useRef(Crypto.randomUUID());
  const fellBack = useRef(false);

  const fallBackToManual = useCallback(
    (reason: string) => {
      if (fellBack.current) return;
      fellBack.current = true;
      Alert.alert(
        'Voice entry is not available',
        `${reason} You can record this sale manually instead.`,
        [{ text: 'Enter sale manually', onPress: onManual }],
        { cancelable: false },
      );
    },
    [onManual],
  );

  useEffect(() => {
    if (!recognitionAvailable()) {
      fallBackToManual('Speech recognition is not available on this device.');
      return;
    }
    listProducts()
      .then(setProducts)
      .catch(() => setError('Could not load products. Check your connection.'));
  }, [fallBackToManual]);

  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error === 'aborted') return;
    const reason = speechUnavailableReason(event.error);
    if (reason) {
      fallBackToManual(reason);
    } else {
      setError("Didn't catch that. Tap the microphone and try again.");
    }
  });

  async function startListening() {
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      fallBackToManual('Microphone or speech permission was denied.');
      return;
    }
    setTranscript('');
    ExpoSpeechRecognitionModule.start({
      lang: language,
      interimResults: true,
      continuous: false,
      contextualStrings: products.map((product) => product.name),
    });
  }

  async function ensureBatches(productId: string): Promise<BatchSummary[]> {
    const cached = batchesByProduct[productId];
    if (cached) return cached;
    const batches = await listBatches(productId);
    setBatchesByProduct((current) => ({ ...current, [productId]: batches }));
    return batches;
  }

  async function createDraft() {
    const text = transcript.trim();
    if (!text) {
      setError('Say or type what was sold first.');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const draft = await createVoiceSaleDraft(text);
      const drafted = linesFromDraft(draft);
      const withBatches = await Promise.all(
        drafted.map(async (line) => {
          if (!line.productId) return line;
          const batches = await ensureBatches(line.productId);
          return { ...line, batchId: pickDefaultBatch(batches)?.id ?? null };
        }),
      );
      idempotencyKey.current = Crypto.randomUUID();
      setWarnings(draft.warnings);
      setLines(withBatches);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        fallBackToManual('Voice parsing is unavailable right now.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not create a draft.');
      }
    } finally {
      setParsing(false);
    }
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    idempotencyKey.current = Crypto.randomUUID();
    setError(null);
    setLines((current) =>
      (current ?? []).map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  async function chooseProduct(key: string, productId: string) {
    updateLine(key, { productId, batchId: null, ambiguity: null });
    try {
      const batches = await ensureBatches(productId);
      updateLine(key, { batchId: pickDefaultBatch(batches)?.id ?? null });
    } catch {
      setError('Could not load batches for that product.');
    }
  }

  function removeLine(key: string) {
    idempotencyKey.current = Crypto.randomUUID();
    setLines((current) => (current ?? []).filter((line) => line.key !== key));
  }

  async function confirm() {
    if (!lines) return;
    const batchesById = Object.fromEntries(
      Object.values(batchesByProduct)
        .flat()
        .map((batch) => [batch.id, batch]),
    );
    const problem = validateLines(lines, batchesById);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitSale({
        source: 'voice',
        items: buildSaleItems(lines),
        idempotencyKey: idempotencyKey.current,
      });
      setSale(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the sale.');
      // Stock may have changed since the draft; refresh the batches shown.
      const productIds = [...new Set(lines.flatMap((line) => line.productId ?? []))];
      const fresh = await Promise.all(
        productIds.map(async (id) => [id, await listBatches(id)] as const),
      ).catch(() => null);
      if (fresh) setBatchesByProduct((current) => ({ ...current, ...Object.fromEntries(fresh) }));
    } finally {
      setBusy(false);
    }
  }

  function productName(productId: string): string {
    return products.find((product) => product.id === productId)?.name ?? 'Product';
  }

  if (sale) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.doneContainer}>
          <View style={styles.doneCheckCircle}>
            <Text style={styles.doneCheckMark}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Voice Sale Recorded</Text>
          <View style={styles.card}>
            {sale.items.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {getProduceEmoji(productName(item.product_id))} {productName(item.product_id)} × {item.quantity_sold}
                </Text>
                <Text style={styles.summaryValue}>{item.quantity_remaining} left</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.primaryBtn} onPress={onDone} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Voice Sale</Text>
        <Pressable onPress={onDone} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {lines === null ? (
          <>
            <Text style={styles.sectionLabel}>Language</Text>
            <View style={styles.chipRow}>
              {VOICE_LANGUAGES.map((option) => (
                <Pressable
                  key={option.code}
                  style={[styles.chip, language === option.code && styles.chipActive]}
                  onPress={() => setLanguage(option.code)}
                  disabled={listening}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, language === option.code && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.micButton, listening && styles.micButtonActive]}
              onPress={() =>
                listening ? ExpoSpeechRecognitionModule.stop() : void startListening()
              }
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
            >
              <Text style={styles.micEmoji}>{listening ? '■' : '🎤'}</Text>
              <Text style={styles.micText}>{listening ? 'Listening… tap to stop' : 'Tap and say what you sold'}</Text>
            </Pressable>
            <Text style={styles.hint}>For example: "two tomatoes and three bananas"</Text>

            <Text style={styles.sectionLabel}>Transcript (you can edit it)</Text>
            <TextInput
              style={styles.transcriptInput}
              value={transcript}
              onChangeText={setTranscript}
              placeholder="Your words appear here"
              multiline
              maxLength={2000}
              editable={!listening}
            />

            <Pressable
              style={[styles.primaryBtn, (parsing || listening) && styles.btnDisabled]}
              onPress={() => void createDraft()}
              disabled={parsing || listening}
              accessibilityRole="button"
            >
              {parsing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create Sale Draft</Text>}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={onManual} accessibilityRole="button">
              <Text style={styles.secondaryBtnText}>Enter sale manually</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Check every line before confirming</Text>
            {warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>ℹ️ {warning}</Text>
            ))}

            {lines.map((line) => {
              const batches = line.productId ? batchesByProduct[line.productId] ?? [] : [];
              return (
                <View key={line.key} style={[styles.card, line.ambiguity && styles.cardFlagged]}>
                  <View style={styles.lineHeader}>
                    <Text style={styles.spoken}>You said: "{line.spokenProduct}"</Text>
                    <Pressable onPress={() => removeLine(line.key)} accessibilityRole="button">
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                  {line.ambiguity ? <Text style={styles.ambiguity}>⚠️ {line.ambiguity}</Text> : null}

                  <Text style={styles.fieldLabel}>Product</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {products.map((product) => (
                      <Pressable
                        key={product.id}
                        style={[styles.chip, line.productId === product.id && styles.chipActive]}
                        onPress={() => void chooseProduct(line.key, product.id)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.chipText, line.productId === product.id && styles.chipTextActive]}>
                          {getProduceEmoji(product.name)} {product.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  {line.productId ? (
                    <>
                      <Text style={styles.fieldLabel}>Batch</Text>
                      {batches.length === 0 ? (
                        <Text style={styles.hint}>No batches with stock for this product.</Text>
                      ) : (
                        <View style={styles.chipRow}>
                          {batches.map((batch) => (
                            <Pressable
                              key={batch.id}
                              style={[styles.chip, line.batchId === batch.id && styles.chipActive]}
                              onPress={() => updateLine(line.key, { batchId: batch.id })}
                              accessibilityRole="button"
                            >
                              <Text style={[styles.chipText, line.batchId === batch.id && styles.chipTextActive]}>
                                {batch.intake_date.slice(0, 10)} · {batch.quantity_remaining} left
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  ) : null}

                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={() => void confirm()}
              disabled={busy || lines.length === 0}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Confirm Sale ({lines.length} item{lines.length === 1 ? '' : 's'})
                </Text>
              )}
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setLines(null);
                setWarnings([]);
                setError(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>Record again</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0d3427',
  },
  topBarTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 18, gap: 12, paddingBottom: 48 },
  errorBox: {
    backgroundColor: '#ffebe9',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ba1a1a',
  },
  errorBoxText: { color: '#ba1a1a', fontSize: 13, fontWeight: '600' },
  sectionLabel: {
    color: '#18533d',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#d7e3da',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { borderColor: '#196a49', backgroundColor: '#e8f5ed' },
  chipText: { color: '#2c3a31', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#196a49', fontWeight: '800' },
  micButton: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#196a49',
    borderRadius: 20,
    paddingVertical: 28,
    marginTop: 8,
  },
  micButtonActive: { backgroundColor: '#ba1a1a' },
  micEmoji: { fontSize: 40, color: '#fff' },
  micText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { color: '#536158', fontSize: 12, textAlign: 'center' },
  transcriptInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e3da',
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: '#18241d',
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: '#196a49',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#196a49', fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  warningText: { color: '#8a5a00', fontSize: 13 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#d7e3da',
  },
  cardFlagged: { borderColor: '#c47d00', backgroundColor: '#fffaf0' },
  lineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spoken: { flex: 1, color: '#18241d', fontSize: 14, fontWeight: '700' },
  removeText: { color: '#ba1a1a', fontSize: 12, fontWeight: '700' },
  ambiguity: { color: '#8a5a00', fontSize: 12, fontWeight: '600' },
  fieldLabel: { color: '#536158', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#196a49', fontSize: 22, fontWeight: '800' },
  qtyValue: { fontSize: 20, fontWeight: '800', color: '#18241d', minWidth: 32, textAlign: 'center' },
  doneContainer: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  doneCheckCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#196a49',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheckMark: { color: '#fff', fontSize: 36, fontWeight: '800' },
  doneTitle: { textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#0d3427' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#18241d', fontSize: 14, fontWeight: '600' },
  summaryValue: { color: '#196a49', fontSize: 14, fontWeight: '800' },
});
