const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_API_URL',
];

const missing = required.filter((name) => !process.env[name]?.trim());
const placeholder = required.filter((name) => {
  const value = process.env[name] ?? '';
  return value.includes('your-project') || value.includes('your-publishable-key');
});

if (missing.length > 0 || placeholder.length > 0) {
  const details = [];
  if (missing.length > 0) details.push(`missing: ${missing.join(', ')}`);
  if (placeholder.length > 0) details.push(`placeholder: ${placeholder.join(', ')}`);

  console.error(`\nMobile environment is not configured (${details.join('; ')}).`);
  console.error('Copy .env.example to .env.local and set every EXPO_PUBLIC_* value.');
  console.error('SUPABASE_URL without the EXPO_PUBLIC_ prefix is not included in an Expo bundle.\n');
  process.exit(1);
}

const apiUrl = new URL(process.env.EXPO_PUBLIC_API_URL);
if (apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
  console.warn(
    'Warning: EXPO_PUBLIC_API_URL uses localhost. A physical phone must use the development machine LAN address.',
  );
}

console.log('Mobile environment is configured.');
