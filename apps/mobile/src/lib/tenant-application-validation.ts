export interface TenantApplicationInput {
  organization: string;
  name: string;
  email: string;
  phone: string;
}

export type TenantApplicationField = keyof TenantApplicationInput;
export type TenantApplicationErrors = Partial<Record<TenantApplicationField, string>>;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateTenantApplication(
  input: TenantApplicationInput,
): TenantApplicationErrors {
  const errors: TenantApplicationErrors = {};
  const organization = input.organization.trim();
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (organization.length < 2) {
    errors.organization = 'Enter your store or organization name.';
  } else if (organization.length > 120) {
    errors.organization = 'Use 120 characters or fewer.';
  }
  if (name.length < 2) {
    errors.name = 'Enter the tenant owner\'s name.';
  } else if (name.length > 120) {
    errors.name = 'Use 120 characters or fewer.';
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address.';
  }
  if (phone && phone.length < 5) {
    errors.phone = 'Enter a valid phone number or leave it blank.';
  } else if (phone.length > 40) {
    errors.phone = 'Use 40 characters or fewer.';
  }

  return errors;
}
