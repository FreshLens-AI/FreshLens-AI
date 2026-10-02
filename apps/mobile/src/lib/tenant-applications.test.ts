import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateTenantApplication } from './tenant-application-validation';

describe('validateTenantApplication', () => {
  it('accepts the same normalized fields as the API contract', () => {
    assert.deepEqual(validateTenantApplication({
      organization: ' Example Grocer ',
      name: ' Shop Owner ',
      email: 'OWNER@example.com',
      phone: ' +94 77 123 4567 ',
    }), {});
  });

  it('reports each invalid application field', () => {
    assert.deepEqual(validateTenantApplication({
      organization: ' ',
      name: 'A',
      email: 'not-an-email',
      phone: '123',
    }), {
      organization: 'Enter your store or organization name.',
      name: "Enter the tenant owner's name.",
      email: 'Enter a valid email address.',
      phone: 'Enter a valid phone number or leave it blank.',
    });
  });

  it('allows an omitted phone number', () => {
    assert.deepEqual(validateTenantApplication({
      organization: 'Example Grocer',
      name: 'Shop Owner',
      email: 'owner@example.com',
      phone: '',
    }), {});
  });
});
