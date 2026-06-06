import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ContactsDirectoryPage } from './contacts-directory-page';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const contacts = [
  { extension_id: 'ext-1', extension_number: '101', display_name: 'Alice Smith', presence_status: 'available' },
  { extension_id: 'ext-2', extension_number: '102', display_name: 'Bob Jones', presence_status: 'busy' },
  { extension_id: 'ext-3', extension_number: '103', display_name: 'Carol White', presence_status: null },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ContactsDirectoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactsDirectoryPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({ data: contacts });
  });

  it('shows all contacts after load', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
  });

  it('filters contacts by name', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bob' } });
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('filters contacts by extension number', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '103' } });
    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
  });

  it('shows no-match message when search has no results', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzznomatch' } });
    expect(screen.getByText('No contacts match your search.')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/failed to load contacts/i)).toBeInTheDocument(),
    );
  });
});
