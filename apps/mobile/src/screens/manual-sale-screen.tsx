import { useEffect, useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    void listProducts()
      .then(setProducts)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load products.');
      });
  }, []);

  async function selectProduct(next: ProductSummary) {
    setProduct(next);
    setBatch(null);
    setError(null);
    try {
      setBatches(await listBatches(next.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load batches.');
    }
  }

  async function confirm() {
    if (!product || !batch) {
      setError('Select a product and batch.');
      return;
    }
    const quantity = Number(quantityText);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Quantity must be a whole number of at least 1.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sale = await createSale({
        productId: product.id,
        batchId: batch.id,
        quantitySold: quantity,
        idempotencyKey: globalThis.crypto.randomUUID(),
      });
      const remaining = sale.items[0]?.quantity_remaining;
      setDoneMessage(
        `Sold ${quantity} ${product.name}. ${remaining ?? 0} remaining in batch.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sale failed.');
    } finally {
      setBusy(false);
    }
  }

  if (doneMessage) {
    return (
      <SafeAreaView style={styles.page}>
        <Text style={styles.title}>Sale recorded</Text>
        <Text style={styles.copy}>{doneMessage}</Text>
        <Pressable style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Back to home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Manual sale</Text>
        <Text style={styles.title}>Confirm one item</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Product</Text>
        {products.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.choice, product?.id === item.id && styles.choiceOn]}
            onPress={() => void selectProduct(item)}
          >
            <Text style={styles.choiceText}>{item.name}</Text>
          </Pressable>
        ))}
        {product ? (
          <>
            <Text style={styles.label}>Batch</Text>
            {batches.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.choice, batch?.id === item.id && styles.choiceOn]}
                onPress={() => setBatch(item)}
              >
                <Text style={styles.choiceText}>
                  {item.quantity_remaining} left · {item.intake_date.slice(0, 10)}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={quantityText}
              onChangeText={setQuantityText}
            />
            <Pressable
              style={[styles.button, busy && styles.buttonOff]}
              onPress={() => void confirm()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirm sale</Text>
              )}
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={onDone}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7f4' },
  content: { padding: 24, gap: 10, paddingBottom: 48 },
  eyebrow: {
    color: '#196a49',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: '#17221c', fontSize: 28, fontWeight: '800' },
  copy: { color: '#536158', fontSize: 14, lineHeight: 22, marginTop: 12 },
  label: { marginTop: 12, fontWeight: '700', color: '#18533d' },
  choice: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e3da',
  },
  choiceOn: { borderColor: '#196a49', backgroundColor: '#e8f5ed' },
  choiceText: { color: '#17221c', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e3da',
    padding: 14,
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#196a49',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonOff: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 18, textAlign: 'center', color: '#536158' },
  error: { color: '#B3261E', fontSize: 14 },
});
