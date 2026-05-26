import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthPage } from './auth-page';
import { renderWithProviders } from '@/test/render';

const signIn = vi.fn();
const navigate = vi.fn();

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    signIn,
  }),
}));

vi.mock('@/lib/api/client', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('AuthPage', () => {
  it('shows login form by default and switches to register mode', () => {
    renderWithProviders(<AuthPage />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register Tenant' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(screen.getByRole('button', { name: 'Register Tenant' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tenant name')).toBeInTheDocument();
  });
});
