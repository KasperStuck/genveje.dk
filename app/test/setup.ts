import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for tests
process.env.PARTNER_ADS_API_KEY = 'test-partner-ads-key';
process.env.ADTRACTION_API_TOKEN = 'test-adtraction-token';
process.env.ENABLE_CRON = 'false';
