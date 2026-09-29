import http from 'k6/http';
import { check, sleep } from 'k6';

const config = JSON.parse(open(__ENV.FRESHLENS_SYSTEM_CONFIG));
const profile = __ENV.PERF_PROFILE || 'smoke';
const profiles = {
  smoke: { vus: 1, duration: '10s' },
  load: { stages: [
    { duration: '10s', target: 5 }, { duration: '10s', target: 10 },
    { duration: '30s', target: 10 }, { duration: '10s', target: 0 },
  ] },
  spike: { stages: [
    { duration: '10s', target: 2 }, { duration: '2s', target: 25 },
    { duration: '15s', target: 25 }, { duration: '2s', target: 2 },
    { duration: '10s', target: 2 }, { duration: '5s', target: 0 },
  ] },
};
if (!profiles[profile]) throw new Error(`Unknown profile: ${profile}`);
// This script only consumes the disposable local stack configuration.
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.base_url)) {
  throw new Error('Performance evidence must target the isolated loopback API');
}

export const options = {
  ...profiles[profile],
  gracefulStop: '10s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
    'http_req_duration{kind:read}': ['p(95)<500'],
    'http_req_duration{kind:write}': ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function json(response) {
  try { return response.json(); } catch (_) { return {}; }
}

export default function () {
  const actor = config.actors[__VU % 2 ? 'a' : 'b'];
  const headers = { Authorization: `Bearer ${actor.token}` };
  for (const endpoint of ['products', 'batches', 'alerts', 'scans']) {
    const response = http.get(`${config.base_url}/api/v1/${endpoint}`, {
      headers, tags: { name: `GET /api/v1/${endpoint}`, kind: 'read' }, timeout: '5s',
    });
    const body = json(response);
    check(response, {
      [`${endpoint}: HTTP 200`]: (r) => r.status === 200,
      [`${endpoint}: populated list`]: () => Array.isArray(body.items) && body.items.length > 0,
      [`${endpoint}: tenant boundary`]: () => Array.isArray(body.items) && body.items.every((item) =>
        endpoint === 'products' ? item.id === actor.product_id
          : endpoint === 'batches' ? item.product_id === actor.product_id
            : endpoint === 'scans' ? item.tenant_id === actor.tenant_id : item.product_id === actor.product_id),
    });
  }
  // Exercise real writes and idempotent replay without double stock deduction.
  if (__ITER % 5 === 0) {
    const payload = JSON.stringify({ source: 'manual', items: [
      { product_id: actor.product_id, batch_id: actor.batch_id, quantity_sold: 1 },
    ] });
    const params = { headers: { ...headers, 'Content-Type': 'application/json',
      'Idempotency-Key': `k6-${profile}-${__VU}-${__ITER}` },
      tags: { name: 'POST /api/v1/sales', kind: 'write' }, timeout: '5s' };
    const first = http.post(`${config.base_url}/api/v1/sales`, payload, params);
    const second = http.post(`${config.base_url}/api/v1/sales`, payload, params);
    const sale = json(first);
    check(first, { 'sale: HTTP 201': (r) => r.status === 201 });
    check(second, {
      'replay: HTTP 201': (r) => r.status === 201,
      'replay: same sale ID': () => typeof sale.id === 'string' && json(second).id === sale.id,
    });
  }
  sleep(0.25);
}
