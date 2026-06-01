import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBuilderCapability } from './use-builder-capability';

vi.mock('@/lib/auth/use-auth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/lib/auth/use-auth';

function makeSession(role: string) {
  return { token: 'tok', claims: { role, tenant_id: 't1', sub: 'u', email: 'u@e.com' } };
}

describe('useBuilderCapability', () => {
  it('grants all capabilities to tenant_admin', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_admin') } as never);
    const { result } = renderHook(() => useBuilderCapability());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canValidate).toBe(true);
    expect(result.current.canSimulate).toBe(true);
    expect(result.current.canPublish).toBe(true);
    expect(result.current.canRollback).toBe(true);
  });

  it('grants view-only capabilities to tenant_viewer (no edit/publish/rollback)', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_viewer') } as never);
    const { result } = renderHook(() => useBuilderCapability());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canPublish).toBe(false);
    expect(result.current.canRollback).toBe(false);
  });

  it('grants edit+validate+simulate but not publish/rollback to tenant_operator', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_operator') } as never);
    const { result } = renderHook(() => useBuilderCapability());
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canValidate).toBe(true);
    expect(result.current.canSimulate).toBe(true);
    expect(result.current.canPublish).toBe(false);
    expect(result.current.canRollback).toBe(false);
  });

  it('returns false for all when session is null', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null } as never);
    const { result } = renderHook(() => useBuilderCapability());
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canPublish).toBe(false);
  });
});
