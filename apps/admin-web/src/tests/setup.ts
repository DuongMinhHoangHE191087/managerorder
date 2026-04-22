// Global Vitest setup file
// Runs before every test file

// Suppress console.error from api-helpers (avoids noise in test output)
import { vi } from 'vitest';

// Silence known console.error calls from `serverErrorResponse`
vi.spyOn(console, 'error').mockImplementation(() => {});
