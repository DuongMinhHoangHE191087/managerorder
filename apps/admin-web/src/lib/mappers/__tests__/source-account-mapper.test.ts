import { describe, it, expect } from 'vitest';
import { parseOrderRelation } from '../source-account.mapper';

describe('parseOrderRelation', () => {
  it('returns null when input is null', () => {
    expect(parseOrderRelation(null)).toBeNull();
  });

  it('returns null when input is undefined', () => {
    expect(parseOrderRelation(undefined as unknown as null)).toBeNull();
  });

  it('returns the object directly when input is a single object', () => {
    const order = { id: '00000000-0000-4000-8000-00000000005b', customer_id: '00000000-0000-4000-8000-000000000005' };
    expect(parseOrderRelation(order)).toEqual(order);
  });

  it('returns first element when input is an array', () => {
    const orders = [
      { id: '00000000-0000-4000-8000-00000000005b', customer_id: '00000000-0000-4000-8000-000000000005' },
      { id: '00000000-0000-4000-8000-0000000000c5', customer_id: '00000000-0000-4000-8000-000000000006' },
    ];
    expect(parseOrderRelation(orders)).toEqual(orders[0]);
  });

  it('returns null for empty array', () => {
    expect(parseOrderRelation([])).toBeNull();
  });

  it('returns first when array has one item', () => {
    const orders = [{ id: '00000000-0000-4000-8000-00000000005b' }];
    expect(parseOrderRelation(orders)).toEqual({ id: '00000000-0000-4000-8000-00000000005b' });
  });

  it('works with generic types', () => {
    const result = parseOrderRelation<{ name: string }>({ name: 'test' });
    expect(result?.name).toBe('test');
  });
});
