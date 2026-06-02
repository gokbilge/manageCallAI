import { describe, expect, it } from 'vitest';
import { paths } from './paths';

describe('paths', () => {
  it('builds tenant runtime session detail paths', () => {
    expect(paths.tenant.runtimeSession('sess-123')).toBe('/tenant/runtime/sessions/sess-123');
  });
});
