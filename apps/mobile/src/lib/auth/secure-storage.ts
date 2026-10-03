import * as SecureStore from 'expo-secure-store';

import { createChunkedSessionStorage } from './chunked-storage';
import { createAuthPreferences } from './preferences';

export const secureSessionStorage = createChunkedSessionStorage(SecureStore);

export const authPreferences = createAuthPreferences(SecureStore);
