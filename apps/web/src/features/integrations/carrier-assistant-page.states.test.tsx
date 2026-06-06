import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarrierAssistantPage } from './carrier-assistant-page';
import { renderWithProviders } from '@/test/render';

const trunksState = {
  data: [] as Array<{ id: string; name: string }>,
  refetch: vi.fn(),
};

const assistantState = {
  data: undefined as { data: unknown } | undefined,
  isPending: false,
  isError: false,
  error: null as Error | null,
  mutate: vi.fn(),
};

vi.mock('@/lib/sip-trunks/sip-trunks-api', () => ({
  useSipTrunks: () => trunksState,
}));

vi.mock('@/lib/sip-trunks/carrier-assistant-api', () => ({
  useCarrierAssistantSuggestion: () => assistantState,
}));

describe('CarrierAssistantPage states', () => {
  beforeEach(() => {
    trunksState.data = [{ id: 'trunk-1', name: 'Primary Carrier' }];
    trunksState.refetch.mockReset();
    assistantState.data = undefined;
    assistantState.isPending = false;
    assistantState.isError = false;
    assistantState.error = null;
    assistantState.mutate.mockReset();
  });

  it('renders a pending assistant request state', () => {
    assistantState.isPending = true;

    renderWithProviders(<CarrierAssistantPage />);
    fireEvent.change(screen.getByPlaceholderText(/Set up a Telnyx TLS trunk/i), {
      target: { value: 'Create a carrier draft' },
    });

    expect(screen.getByRole('button', { name: /Generating draft/i })).toBeDisabled();
  });

  it('renders assistant request failures', () => {
    assistantState.isError = true;
    assistantState.error = new Error('draft failed');

    renderWithProviders(<CarrierAssistantPage />);

    expect(screen.getByText('draft failed')).toBeInTheDocument();
  });
});
