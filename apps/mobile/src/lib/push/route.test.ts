import assert from 'node:assert/strict';
import test from 'node:test';

import { destinationForNotification, parsePushPayload } from './route';

test('scan pushes open scan history', () => {
  const data = { type: 'scan', scan_id: 'scan-1', status: 'completed' };
  assert.deepEqual(parsePushPayload(data), {
    type: 'scan',
    scanId: 'scan-1',
    status: 'completed',
  });
  assert.deepEqual(destinationForNotification(data), { name: 'History' });
});

test('alert pushes open alerts', () => {
  const data = { type: 'alert', alert_id: 'alert-1' };
  assert.deepEqual(parsePushPayload(data), { type: 'alert', alertId: 'alert-1' });
  assert.deepEqual(destinationForNotification(data), {
    name: 'Alerts',
    params: { alertId: 'alert-1' },
  });
});

test('malformed or foreign payloads are ignored', () => {
  for (const data of [
    null,
    undefined,
    'scan',
    {},
    { type: 'scan' },
    { type: 'alert', alert_id: '  ' },
    { type: 'promo', url: 'https://example.com' },
  ]) {
    assert.equal(destinationForNotification(data), null);
  }
});
