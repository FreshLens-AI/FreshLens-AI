// Pure state helpers for the voice sale flow. The draft from the API is
// untrusted: every line must be resolved to a product and batch and confirmed
// by the vendor before it becomes a POST /api/v1/sales call.

export interface VoiceSaleDraftItem {
  spoken_product: string;
  quantity_sold: number;
  matched_product_id: string | null;
  confidence?: number | null;
  ambiguity?: string | null;
}

export interface VoiceSaleDraft {
  items: VoiceSaleDraftItem[];
  requires_confirmation: true;
  warnings: string[];
}

export interface DraftBatch {
  id: string;
  product_id: string;
  intake_date: string;
  quantity_remaining: number;
}

export interface DraftLine {
  key: string;
  spokenProduct: string;
  productId: string | null;
  batchId: string | null;
  quantity: number;
  ambiguity: string | null;
}

export interface SaleItemPayload {
  product_id: string;
  batch_id: string;
  quantity_sold: number;
}

export const VOICE_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'si-LK', label: 'සිංහල' },
  { code: 'ta-LK', label: 'தமிழ்' },
] as const;

const LOW_CONFIDENCE = 0.6;

export function linesFromDraft(draft: VoiceSaleDraft): DraftLine[] {
  return draft.items.map((item, index) => {
    const lowConfidence =
      item.matched_product_id !== null &&
      typeof item.confidence === 'number' &&
      item.confidence < LOW_CONFIDENCE;
    return {
      key: `line-${index}`,
      spokenProduct: item.spoken_product,
      productId: item.matched_product_id,
      batchId: null,
      quantity: Math.max(1, Math.floor(item.quantity_sold)),
      ambiguity:
        item.ambiguity ?? (lowConfidence ? 'Low confidence match; please check.' : null),
    };
  });
}

/** Pre-select the oldest batch with stock (first in, first out). */
export function pickDefaultBatch(batches: DraftBatch[]): DraftBatch | null {
  const inStock = batches.filter((batch) => batch.quantity_remaining > 0);
  if (inStock.length === 0) return null;
  return [...inStock].sort((a, b) => a.intake_date.localeCompare(b.intake_date))[0];
}

/** Returns a vendor-facing problem, or null when the draft can be submitted. */
export function validateLines(
  lines: DraftLine[],
  batchesById: Record<string, DraftBatch>,
): string | null {
  if (lines.length === 0) return 'Add at least one item to the sale.';
  const requested: Record<string, number> = {};
  for (const line of lines) {
    if (!line.productId) return `Choose a product for "${line.spokenProduct}".`;
    if (!line.batchId) return `Choose a batch for "${line.spokenProduct}".`;
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return `Enter a quantity of at least 1 for "${line.spokenProduct}".`;
    }
    const batch = batchesById[line.batchId];
    if (!batch || batch.product_id !== line.productId) {
      return `Choose a batch for "${line.spokenProduct}".`;
    }
    requested[line.batchId] = (requested[line.batchId] ?? 0) + line.quantity;
    if (requested[line.batchId] > batch.quantity_remaining) {
      return `Only ${batch.quantity_remaining} left in the selected batch for "${line.spokenProduct}".`;
    }
  }
  return null;
}

/** Merge lines that resolve to the same batch into one sale item. */
export function buildSaleItems(lines: DraftLine[]): SaleItemPayload[] {
  const byBatch = new Map<string, SaleItemPayload>();
  for (const line of lines) {
    if (!line.productId || !line.batchId) continue;
    const existing = byBatch.get(line.batchId);
    if (existing) {
      existing.quantity_sold += line.quantity;
    } else {
      byBatch.set(line.batchId, {
        product_id: line.productId,
        batch_id: line.batchId,
        quantity_sold: line.quantity,
      });
    }
  }
  return [...byBatch.values()];
}

/**
 * Speech errors that mean voice entry cannot work right now, so the vendor is
 * told and sent to manual entry. Others ("no-speech", "aborted") just let them
 * try again.
 */
export function speechUnavailableReason(errorCode: string): string | null {
  switch (errorCode) {
    case 'not-allowed':
      return 'Microphone or speech permission was denied.';
    case 'service-not-allowed':
    case 'language-not-supported':
      return 'Speech recognition for this language is not available on this device.';
    case 'audio-capture':
      return 'The microphone could not be used.';
    case 'network':
      return 'Speech recognition needs a network connection on this device.';
    default:
      return null;
  }
}
