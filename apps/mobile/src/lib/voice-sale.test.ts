import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSaleItems,
  linesFromDraft,
  pickDefaultBatch,
  speechUnavailableReason,
  validateLines,
  type DraftBatch,
  type DraftLine,
} from './voice-sale';

const older: DraftBatch = {
  id: 'b-old',
  product_id: 'tomato',
  intake_date: '2026-09-28T08:00:00Z',
  quantity_remaining: 3,
};
const newer: DraftBatch = {
  id: 'b-new',
  product_id: 'tomato',
  intake_date: '2026-10-01T08:00:00Z',
  quantity_remaining: 10,
};
const empty: DraftBatch = {
  id: 'b-empty',
  product_id: 'tomato',
  intake_date: '2026-09-20T08:00:00Z',
  quantity_remaining: 0,
};

function line(overrides: Partial<DraftLine> = {}): DraftLine {
  return {
    key: 'l1',
    spokenProduct: 'tomato',
    productId: 'tomato',
    batchId: 'b-old',
    quantity: 2,
    ambiguity: null,
    ...overrides,
  };
}

describe('linesFromDraft', () => {
  it('keeps matches, flags low confidence, and leaves batches for the vendor', () => {
    const lines = linesFromDraft({
      requires_confirmation: true,
      warnings: [],
      items: [
        { spoken_product: 'tomato', quantity_sold: 2, matched_product_id: 'tomato', confidence: 0.9 },
        { spoken_product: 'kesel', quantity_sold: 3, matched_product_id: 'banana', confidence: 0.4 },
        { spoken_product: 'mango', quantity_sold: 1, matched_product_id: null, ambiguity: 'No match' },
      ],
    });

    assert.equal(lines.length, 3);
    assert.equal(lines[0].ambiguity, null);
    assert.match(lines[1].ambiguity ?? '', /confidence/);
    assert.equal(lines[2].productId, null);
    assert.equal(lines[2].ambiguity, 'No match');
    assert.ok(lines.every((item) => item.batchId === null));
  });
});

describe('pickDefaultBatch', () => {
  it('pre-selects the oldest batch that still has stock', () => {
    assert.equal(pickDefaultBatch([newer, empty, older])?.id, 'b-old');
  });

  it('returns null when nothing is in stock', () => {
    assert.equal(pickDefaultBatch([empty]), null);
  });
});

describe('validateLines', () => {
  const batches = { 'b-old': older, 'b-new': newer };

  it('accepts a fully resolved draft', () => {
    assert.equal(validateLines([line()], batches), null);
  });

  it('requires a product and a batch on every line', () => {
    assert.match(validateLines([line({ productId: null })], batches) ?? '', /product/);
    assert.match(validateLines([line({ batchId: null })], batches) ?? '', /batch/);
  });

  it('rejects a batch from another product', () => {
    assert.match(
      validateLines([line({ productId: 'banana' })], batches) ?? '',
      /batch/,
    );
  });

  it('rejects overselling a batch across lines', () => {
    const lines = [line({ quantity: 2 }), line({ key: 'l2', quantity: 2 })];
    assert.match(validateLines(lines, batches) ?? '', /Only 3 left/);
  });

  it('rejects an empty draft', () => {
    assert.ok(validateLines([], batches));
  });
});

describe('buildSaleItems', () => {
  it('merges lines that share a batch', () => {
    const items = buildSaleItems([
      line({ quantity: 1 }),
      line({ key: 'l2', quantity: 2 }),
      line({ key: 'l3', batchId: 'b-new', quantity: 4 }),
    ]);
    assert.deepEqual(items, [
      { product_id: 'tomato', batch_id: 'b-old', quantity_sold: 3 },
      { product_id: 'tomato', batch_id: 'b-new', quantity_sold: 4 },
    ]);
  });
});

describe('speechUnavailableReason', () => {
  it('sends permission and service failures to manual entry', () => {
    assert.ok(speechUnavailableReason('not-allowed'));
    assert.ok(speechUnavailableReason('language-not-supported'));
  });

  it('lets the vendor retry transient errors', () => {
    assert.equal(speechUnavailableReason('no-speech'), null);
    assert.equal(speechUnavailableReason('aborted'), null);
  });
});
