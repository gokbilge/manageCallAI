import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlphaBanner } from './alpha-banner';
import { renderWithProviders } from '@/test/render';

const DISMISSED_KEY = 'managecallai_alpha_banner_dismissed';

describe('AlphaBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders alpha notice by default', () => {
    renderWithProviders(<AlphaBanner />);
    expect(screen.getByRole('banner', { name: /alpha software notice/i })).toBeInTheDocument();
    expect(screen.getByText(/alpha software/i)).toBeInTheDocument();
    expect(screen.getByText(/not production-ready/i)).toBeInTheDocument();
  });

  it('renders alpha limitations link', () => {
    renderWithProviders(<AlphaBanner />);
    expect(screen.getByRole('link', { name: /alpha limitations/i })).toBeInTheDocument();
  });

  it('dismisses when the dismiss button is clicked', () => {
    renderWithProviders(<AlphaBanner />);
    const dismissBtn = screen.getByRole('button', { name: /dismiss alpha notice/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole('banner', { name: /alpha software notice/i })).not.toBeInTheDocument();
  });

  it('persists dismissal in localStorage', () => {
    renderWithProviders(<AlphaBanner />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss alpha notice/i }));
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });

  it('stays hidden when previously dismissed', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    renderWithProviders(<AlphaBanner />);
    expect(screen.queryByRole('banner', { name: /alpha software notice/i })).not.toBeInTheDocument();
  });
});
