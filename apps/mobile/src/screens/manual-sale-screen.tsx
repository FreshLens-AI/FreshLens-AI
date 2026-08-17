import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ApiError,
  createSale,
  getProduceEmoji,
  listBatches,
  listProducts,
  type BatchSummary,
  type ProductSummary,
} from '../lib/api';

export function ManualSaleScreen({ onDone }: { onDone: () => void }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [quantityText, setQuantityText] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [doneData, setDoneData] = useState<{
    productName: string;
    quantity: number;
    remaining: number;
  } | null>(null);

  useEffect(() => {
    void listProducts()
      .then((items) => {
        setProducts(items);
        if (items.length > 0) {
          void selectProduct(items[0]);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load products.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function selectProduct(next: ProductSummary) {
    setProduct(next);
    setBatch(null);
    setError(null);
    try {
      const loadedBatches = await listBatches(next.id);
      setBatches(loadedBatches);
      if (loadedBatches.length > 0) {
        setBatch(loadedBatches[0]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load batches.');
    }
  }

  function adjustQuantity(delta: number) {
    const current = parseInt(quantityText, 10) || 1;
    const max = batch ? batch.quantity_remaining : 999;
    const next = Math.max(1, Math.min(max, current + delta));
    setQuantityText(String(next));
    setError(null);
  }

  async function confirm() {
    if (!product || !batch) {
      setError('Please select a product and active batch.');
      return;
    }
    const quantity = Number(quantityText);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be a whole number of at least 1.');
      return;
    }
    if (quantity > batch.quantity_remaining) {
      setError(`Quantity exceeds remaining batch stock (${batch.quantity_remaining} units available).`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const sale = await createSale({
        productId: product.id,
        batchId: batch.id,
        quantitySold: quantity,
        idempotencyKey: Crypto.randomUUID(),
      });
      const remaining = sale.items[0]?.quantity_remaining ?? (batch.quantity_remaining - quantity);
      setDoneData({
        productName: product.name,
        quantity,
        remaining,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale confirmation failed.');
    } finally {
      setBusy(false);
    }
  }

  function resetForNextSale() {
    setDoneData(null);
    setQuantityText('1');
    setError(null);
    if (product) {
      void selectProduct(product);
    }
  }

  if (doneData) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.doneContainer}>
          <View style={styles.doneCheckCircle}>
            <Text style={styles.doneCheckMark}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Sale Recorded</Text>
          <Text style={styles.doneSubtitle}>
            Successfully deducted {doneData.quantity} unit{doneData.quantity > 1 ? 's' : ''} of {doneData.productName} from inventory.
          </Text>

          <View style={styles.doneSummaryCard}>
            <View style={styles.doneSummaryRow}>
              <Text style={styles.doneSummaryLabel}>Item</Text>
              <Text style={styles.doneSummaryVal}>{doneData.productName}</Text>
            </View>
            <View style={styles.doneSummaryRow}>
              <Text style={styles.doneSummaryLabel}>Units Sold</Text>
              <Text style={styles.doneSummaryVal}>{doneData.quantity}</Text>
            </View>
            <View style={styles.doneSummaryDivider} />
            <View style={styles.doneSummaryRow}>
              <Text style={styles.doneSummaryLabel}>Remaining in Batch</Text>
              <Text style={[styles.doneSummaryVal, { color: '#196a49', fontWeight: '800' }]}>
                {doneData.remaining} units
              </Text>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={resetForNextSale}>
            <Text style={styles.primaryBtnText}>Record Another Sale</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onDone}>
            <Text style={styles.secondaryBtnText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const selectedQty = parseInt(quantityText, 10) || 0;
  const remainingProjected = batch ? Math.max(0, batch.quantity_remaining - selectedQty) : 0;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Record Confirmed Sale</Text>
          <Text style={styles.topBarSub}>Idempotent Inventory Ledger</Text>
        </View>
        <Pressable onPress={onDone} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxEmoji}>⚠️</Text>
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#196a49" />
            <Text style={styles.loadingBoxText}>Loading product catalog…</Text>
          </View>
        ) : (
          <>
            {/* Step 1: Select Produce */}
            <Text style={styles.sectionLabel}>1. Select Produce Item</Text>
            <View style={styles.productGrid}>
              {products.map((item) => {
                const isSelected = product?.id === item.id;
                const emoji = getProduceEmoji(item.name);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.productCard, isSelected && styles.productCardActive]}
                    onPress={() => void selectProduct(item)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.productEmoji}>{emoji}</Text>
                    <Text
                      style={[styles.productName, isSelected && styles.productNameActive]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {isSelected ? (
                      <View style={styles.productCheckBadge}>
                        <Text style={styles.productCheckText}>✓</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {/* Step 2: Select Batch */}
            {product ? (
              <>
                <Text style={styles.sectionLabel}>2. Select Batch</Text>
                {batches.length === 0 ? (
                  <View style={styles.noBatchCard}>
                    <Text style={styles.noBatchText}>No active batches found for {product.name}.</Text>
                  </View>
                ) : (
                  batches.map((item) => {
                    const isSelected = batch?.id === item.id;
                    const dateStr = item.intake_date.slice(0, 10);
                    const isLow = item.quantity_remaining <= product.low_stock_threshold;
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.batchCard, isSelected && styles.batchCardActive]}
                        onPress={() => setBatch(item)}
                        accessibilityRole="button"
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.batchDate}>Intake: {dateStr}</Text>
                          <Text style={styles.batchSub}>ID: {item.id.slice(0, 8)}…</Text>
                        </View>
                        <View
                          style={[
                            styles.stockPill,
                            isLow ? styles.stockPillLow : styles.stockPillNormal,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockPillText,
                              isLow ? styles.stockPillTextLow : styles.stockPillTextNormal,
                            ]}
                          >
                            {item.quantity_remaining} in stock
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {/* Step 3: Quantity Controls */}
                <Text style={styles.sectionLabel}>3. Quantity to Deduct</Text>
                <View style={styles.qtyCard}>
                  <View style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => adjustQuantity(-1)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <TextInput
                      style={styles.qtyInput}
                      keyboardType="number-pad"
                      value={quantityText}
                      onChangeText={(t) => {
                        setQuantityText(t);
                        setError(null);
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

                  {/* Preset quick buttons */}
                  <View style={styles.presetRow}>
                    {[1, 2, 5, 10].map((num) => (
                      <Pressable
                        key={num}
                        style={styles.presetChip}
                        onPress={() => setQuantityText(String(num))}
                      >
                        <Text style={styles.presetChipText}>+{num}</Text>
                      </Pressable>
                    ))}
                    {batch ? (
                      <Pressable
                        style={[styles.presetChip, { backgroundColor: '#e8f5ed' }]}
                        onPress={() => setQuantityText(String(batch.quantity_remaining))}
                      >
                        <Text style={[styles.presetChipText, { color: '#196a49', fontWeight: '800' }]}>
                          Max ({batch.quantity_remaining})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Projected stock preview */}
                  <View style={styles.projectedBox}>
                    <Text style={styles.projectedLabel}>Stock after confirmation:</Text>
                    <Text style={styles.projectedValue}>{remainingProjected} units</Text>
                  </View>
                </View>

                {/* Confirm Sale Button */}
                <Pressable
                  style={[styles.confirmBtn, busy && styles.btnDisabled]}
                  onPress={() => void confirm()}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Confirm Sale ({quantityText} {product.name})
                    </Text>
                  )}
                </Pressable>
              </>
            ) : null}
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
  topBarSub: { color: '#a8c4b4', fontSize: 11, marginTop: 1 },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: 18, gap: 12, paddingBottom: 48 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffebe9',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ba1a1a',
  },
  errorBoxEmoji: { fontSize: 18 },
  errorBoxText: { flex: 1, color: '#ba1a1a', fontSize: 13, fontWeight: '600' },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingBoxText: { color: '#536158', fontSize: 13 },
  sectionLabel: {
    color: '#18533d',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  productCard: {
    width: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d7e3da',
    position: 'relative',
  },
  productCardActive: {
    borderColor: '#196a49',
    backgroundColor: '#e8f5ed',
  },
  productEmoji: { fontSize: 32, marginBottom: 6 },
  productName: { fontSize: 15, fontWeight: '700', color: '#17221c' },
  productNameActive: { color: '#196a49', fontWeight: '800' },
  productCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#196a49',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCheckText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noBatchCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e3da',
  },
  noBatchText: { color: '#627067', fontSize: 13, fontStyle: 'italic' },
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#d7e3da',
  },
  batchCardActive: {
    borderColor: '#196a49',
    backgroundColor: '#e8f5ed',
  },
  batchDate: { fontSize: 14, fontWeight: '700', color: '#17221c' },
  batchSub: { fontSize: 11, color: '#849188', marginTop: 2 },
  stockPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  stockPillNormal: { backgroundColor: '#e8f5ed' },
  stockPillLow: { backgroundColor: '#fff3e0' },
  stockPillText: { fontSize: 12, fontWeight: '800' },
  stockPillTextNormal: { color: '#196a49' },
  stockPillTextLow: { color: '#c47d00' },
  qtyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#d7e3da',
    alignItems: 'center',
    gap: 14,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
  qtyInput: {
    width: 90,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#196a49',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#17221c',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  presetChip: {
    backgroundColor: '#f0f4f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  presetChipText: { fontSize: 12, fontWeight: '700', color: '#536158' },
  projectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f4f1',
  },
  projectedLabel: { color: '#849188', fontSize: 12, fontWeight: '600' },
  projectedValue: { color: '#17221c', fontSize: 12, fontWeight: '800' },
  confirmBtn: {
    backgroundColor: '#196a49',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#196a49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  doneCheckCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#e8f5ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  doneCheckMark: { color: '#196a49', fontSize: 38, fontWeight: '900' },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#17221c' },
  doneSubtitle: {
    color: '#536158',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  doneSummaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    marginVertical: 24,
    borderWidth: 1,
    borderColor: '#d7e3da',
    gap: 10,
  },
  doneSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  doneSummaryLabel: { color: '#849188', fontSize: 13, fontWeight: '600' },
  doneSummaryVal: { color: '#17221c', fontSize: 13, fontWeight: '700' },
  doneSummaryDivider: {
    height: 1,
    backgroundColor: '#f0f4f1',
    marginVertical: 4,
  },
  primaryBtn: {
    backgroundColor: '#196a49',
    borderRadius: 12,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d7e3da',
  },
  secondaryBtnText: { color: '#536158', fontSize: 15, fontWeight: '700' },
});

