import * as SecureStore from 'expo-secure-store';

import { createChunkedSessionStorage } from './chunked-storage';

export const secureSessionStorage = createChunkedSessionStorage(SecureStore);
