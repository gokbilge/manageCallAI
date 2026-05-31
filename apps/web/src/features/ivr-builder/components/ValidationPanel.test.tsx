import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ValidationPanel } from './ValidationPanel';
import type { FlowValidationResponse } from '@/lib/ivr-flows/ivr-flows-api';

function makeVersion() {
  return {
    id: 'v1',
    flow_id: 'f1',
    version_number: 1,
    state: 'draft' as const,
    graph_json: {},
    created_at: new Date().toISOString(),
    validated_at: null,
    simulated_at: null,
    published_at: null,
  };
}

describe('ValidationPanel', () => {
  it('shows prompt when no result', () => {
    renderWithProviders(<ValidationPanel result={null} isLoading={false} />);
    expect(screen.getByText(/no validation result/i)).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    renderWithProviders(<ValidationPanel result={null} isLoading={true} />);
    expect(screen.getByText(/validating draft/i)).toBeInTheDocument();
  });

  it('shows passed state', () => {
    const result: FlowValidationResponse = {
      version: makeVersion(),
      outcome: { status: 'passed', errors: [], warnings: [] },
    };
    renderWithProviders(<ValidationPanel result={result} isLoading={false} />);
    expect(screen.getByText(/validation passed/i)).toBeInTheDocument();
    expect(screen.getByText(/all checks passed/i)).toBeInTheDocument();
  });

  it('renders each error with field and message', () => {
    const result: FlowValidationResponse = {
      version: makeVersion(),
      outcome: {
        status: 'failed',
        errors: [
          { field: 'graph_json.entry_node_id', message: 'Entry node does not exist: missing' },
          { field: 'graph_json.nodes[1].type', message: 'Unsupported node type: foo' },
        ],
        warnings: [],
      },
    };
    renderWithProviders(<ValidationPanel result={result} isLoading={false} />);
    expect(screen.getByText(/2 errors found/i)).toBeInTheDocument();
    expect(screen.getByText(/Entry node does not exist/i)).toBeInTheDocument();
    expect(screen.getByText('graph_json.entry_node_id')).toBeInTheDocument();
    expect(screen.getByText(/Unsupported node type/i)).toBeInTheDocument();
  });

  it('renders warnings separately from errors', () => {
    const result: FlowValidationResponse = {
      version: makeVersion(),
      outcome: {
        status: 'passed',
        errors: [],
        warnings: [{ field: 'graph_json.nodes.play.prompt_id', message: 'play_prompt node has no prompt_id — callers will hear silence' }],
      },
    };
    renderWithProviders(<ValidationPanel result={result} isLoading={false} />);
    expect(screen.getByText(/validation passed/i)).toBeInTheDocument();
    expect(screen.getByText(/callers will hear silence/i)).toBeInTheDocument();
  });

  it('uses role=status for live region', () => {
    const result: FlowValidationResponse = {
      version: makeVersion(),
      outcome: { status: 'passed', errors: [], warnings: [] },
    };
    renderWithProviders(<ValidationPanel result={result} isLoading={false} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
