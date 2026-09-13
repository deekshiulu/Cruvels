import { beforeAll, beforeEach } from 'vitest';
import { dataStore } from '../src/lib/db/store';

beforeAll(() => {
  process.env.JWT_SECRET = 'cruvels-test-jwt-secret-key-32-chars-length';
  process.env.EMAIL_PROVIDER_MODE = 'mock';
});

beforeEach(() => {
  dataStore.resetAndSeed();
});
