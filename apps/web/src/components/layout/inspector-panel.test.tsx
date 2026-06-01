import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { InspectorPanel } from './inspector-panel';

describe('InspectorPanel', () => {
  it('renders with tenant workspace context', () => {
    renderWithProviders(<InspectorPanel workspace="tenant" />);
    expect(screen.getByText('Context Inspector')).toBeInTheDocument();
    expect(screen.getByText('Tenant operator context')).toBeInTheDocument();
  });

  it('renders with platform workspace context', () => {
    renderWithProviders(<InspectorPanel workspace="platform" />);
    expect(screen.getByText('Global operator context')).toBeInTheDocument();
  });

  it('renders all three guidance messages', () => {
    renderWithProviders(<InspectorPanel workspace="tenant" />);
    expect(screen.getByText(/Publish, rollback, and token rotation/i)).toBeInTheDocument();
    expect(screen.getByText(/AI and workflow activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Runtime events belong/i)).toBeInTheDocument();
  });
});
