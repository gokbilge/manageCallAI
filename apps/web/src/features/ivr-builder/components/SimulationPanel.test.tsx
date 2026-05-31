import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SimulationPanel } from './SimulationPanel';
import type { FlowSimulationResponse } from '@/lib/ivr-flows/ivr-flows-api';

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

const noopSimulate = vi.fn();

describe('SimulationPanel', () => {
  it('renders the simulation form when no result', () => {
    renderWithProviders(
      <SimulationPanel result={null} isLoading={false} canSimulate={true} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    // The form is always visible; no result means no status block
    expect(screen.getByRole('button', { name: /run simulation/i })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders simulation inputs form', () => {
    renderWithProviders(
      <SimulationPanel result={null} isLoading={false} canSimulate={true} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    expect(screen.getByLabelText(/dtmf digits/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/caller number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/scenario time/i)).toBeInTheDocument();
  });

  it('disables inputs and button when canSimulate is false', () => {
    renderWithProviders(
      <SimulationPanel result={null} isLoading={false} canSimulate={false} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    expect(screen.getByRole('button', { name: /run simulation/i })).toBeDisabled();
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it('calls onSimulate with parsed digits on submit', () => {
    const onSimulate = vi.fn();
    renderWithProviders(
      <SimulationPanel result={null} isLoading={false} canSimulate={true} onSimulate={onSimulate} highlightedPath={[]} />,
    );
    const digitsInput = screen.getByLabelText(/dtmf digits/i);
    fireEvent.change(digitsInput, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /run simulation/i }));
    expect(onSimulate).toHaveBeenCalledOnce();
    expect(onSimulate).toHaveBeenCalledWith(expect.objectContaining({ digits: '2' }));
  });

  it('shows loading state when isLoading', () => {
    renderWithProviders(
      <SimulationPanel result={null} isLoading={true} canSimulate={true} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    expect(screen.getByRole('button', { name: /simulating/i })).toBeDisabled();
  });

  it('renders simulation path as ordered list', () => {
    const result: FlowSimulationResponse = {
      version: makeVersion(),
      scenario: {},
      outcome: {
        status: 'passed',
        path: ['start', 'welcome', 'route_digit', 'sales'],
        steps: [],
        final_action: { type: 'transfer_extension' },
        errors: [],
      },
    };
    renderWithProviders(
      <SimulationPanel
        result={result}
        isLoading={false}
        canSimulate={true}
        onSimulate={noopSimulate}
        highlightedPath={['start', 'welcome', 'route_digit', 'sales']}
      />,
    );
    expect(screen.getByText('start')).toBeInTheDocument();
    expect(screen.getByText('welcome')).toBeInTheDocument();
    expect(screen.getByText('sales')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /simulated node path/i })).toBeInTheDocument();
  });

  it('renders simulation errors with field and message', () => {
    const result: FlowSimulationResponse = {
      version: makeVersion(),
      scenario: {},
      outcome: {
        status: 'failed',
        path: ['start'],
        steps: [],
        final_action: null,
        errors: [{ field: 'graph_json.nodes.menu.schedule_id', message: 'Schedule not found or not active: sched-1' }],
      },
    };
    renderWithProviders(
      <SimulationPanel result={result} isLoading={false} canSimulate={true} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/simulation failed/i);
    expect(screen.getByText(/Schedule not found/i)).toBeInTheDocument();
    expect(screen.getByText('graph_json.nodes.menu.schedule_id')).toBeInTheDocument();
  });

  it('shows final action JSON', () => {
    const result: FlowSimulationResponse = {
      version: makeVersion(),
      scenario: {},
      outcome: {
        status: 'passed',
        path: ['start', 'hangup'],
        steps: [],
        final_action: { type: 'hangup' },
        errors: [],
      },
    };
    renderWithProviders(
      <SimulationPanel result={result} isLoading={false} canSimulate={true} onSimulate={noopSimulate} highlightedPath={[]} />,
    );
    expect(screen.getByText(/"type": "hangup"/)).toBeInTheDocument();
  });

  it('force_timeout checkbox toggles correctly', () => {
    const onSimulate = vi.fn();
    renderWithProviders(
      <SimulationPanel result={null} isLoading={false} canSimulate={true} onSimulate={onSimulate} highlightedPath={[]} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /force timeout/i });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /run simulation/i }));
    expect(onSimulate).toHaveBeenCalledWith(expect.objectContaining({ forceTimeout: true }));
  });
});
