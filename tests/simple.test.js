import { jest } from '@jest/globals';

describe('Simple Test', () => {
  test('should work', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
}); 