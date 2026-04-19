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
    const order = { id: 'order-1', customer_id: 'cust-1' };
    expect(parseOrderRelation(order)).toEqual(order);
  });

  it('returns first element when input is an array', () => {
    const orders = [
      { id: 'order-1', customer_id: 'cust-1' },
      { id: 'order-2', customer_id: 'cust-2' },
    ];
    expect(parseOrderRelation(orders)).toEqual(orders[0]);
  });

  it('returns null for empty array', () => {
    expect(parseOrderRelation([])).toBeNull();
  });

  it('returns first when array has one item', () => {
    const orders = [{ id: 'order-1' }];
    expect(parseOrderRelation(orders)).toEqual({ id: 'order-1' });
  });

  it('works with generic types', () => {
    const result = parseOrderRelation<{ name: string }>({ name: 'test' });
    expect(result?.name).toBe('test');
  });
});
