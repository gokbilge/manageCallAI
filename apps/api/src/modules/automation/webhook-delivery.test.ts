import { describe, it, expect, vi, afterEach } from 'vitest';

describe('fireWebhooks — failure logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logs an error and does not throw when enqueue fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.doMock('./automation.service.js', () => ({
      AutomationService: vi.fn().mockImplementation(() => ({
        enqueueWebhooks: () => Promise.reject(new Error('pool exhausted')),
        processDueWebhookDeliveries: () => Promise.resolve([]),
      })),
    }));
    vi.doMock('./automation.repository.js', () => ({
      AutomationRepository: vi.fn().mockImplementation(() => ({})),
    }));
    vi.doMock('../../db/client.js', () => ({ db: {} }));

    const { fireWebhooks } = await import('./webhook-delivery.js');

    expect(() => fireWebhooks('tenant-1', 'ivr_flow.published', {})).not.toThrow();

    // Allow the rejected promise micro-task to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleError).toHaveBeenCalledWith(
      '[webhooks] failed to enqueue event',
      expect.objectContaining({ event: 'ivr_flow.published', tenantId: 'tenant-1' }),
    );
  });
});
