import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PublishPanel } from './PublishPanel';
import type { FlowVersion } from '@/lib/ivr-flows/ivr-flows-api';

function makeDraftVersion(state: FlowVersion['state'] = 'draft'): FlowVersion {
  return {
    id: 'v1',
    flow_id: 'f1',
    version_number: 1,
    state,
    graph_json: {},
    created_at: new Date().toISOString(),
    validated_at: state === 'validated' || state === 'simulated' ? new Date().toISOString() : null,
    simulated_at: state === 'simulated' ? new Date().toISOString() : null,
    published_at: null,
    metadata: {},
  };
}

const defaultProps = {
  draftVersion: makeDraftVersion(),
  validationResult: null,
  simulationResult: null,
  publishResult: null,
  rollbackResult: null,
  isPublishing: false,
  isRollingBack: false,
  canPublish: true,
  canRollback: true,
  hasActiveVersion: false,
  onPublish: vi.fn(),
  onRollback: vi.fn(),
};

describe('PublishPanel', () => {
  it('shows pre-publish checklist items', () => {
    renderWithProviders(<PublishPanel {...defaultProps} />);
    expect(screen.getByText(/graph validation/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation run/i)).toBeInTheDocument();
  });

  it('disables Publish when draft state is "draft" (not validated)', () => {
    renderWithProviders(<PublishPanel {...defaultProps} draftVersion={makeDraftVersion('draft')} />);
    const publishBtn = screen.getByRole('button', { name: /publish draft/i });
    expect(publishBtn).toBeDisabled();
    expect(screen.getByText(/validate and simulate/i)).toBeInTheDocument();
  });

  it('enables Publish when draft state is "validated"', () => {
    renderWithProviders(<PublishPanel {...defaultProps} draftVersion={makeDraftVersion('validated')} />);
    const publishBtn = screen.getByRole('button', { name: /publish draft/i });
    expect(publishBtn).not.toBeDisabled();
  });

  it('enables Publish when draft state is "simulated"', () => {
    renderWithProviders(<PublishPanel {...defaultProps} draftVersion={makeDraftVersion('simulated')} />);
    const publishBtn = screen.getByRole('button', { name: /publish draft/i });
    expect(publishBtn).not.toBeDisabled();
  });

  it('shows permission note when canPublish is false', () => {
    renderWithProviders(<PublishPanel {...defaultProps} canPublish={false} />);
    expect(screen.getByText(/your role does not have publish permission/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish draft/i })).toBeDisabled();
  });

  it('calls onPublish when publish button is clicked', () => {
    const onPublish = vi.fn();
    renderWithProviders(
      <PublishPanel {...defaultProps} draftVersion={makeDraftVersion('validated')} onPublish={onPublish} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /publish draft/i }));
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it('shows approval pending state when publishResult is pending_approval', () => {
    renderWithProviders(
      <PublishPanel
        {...defaultProps}
        publishResult={{ status: 'pending_approval', flow: {} as never, approval_request_id: 'req-abc-123' }}
      />,
    );
    expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
    expect(screen.getByText('req-abc-123')).toBeInTheDocument();
  });

  it('shows rollback button when hasActiveVersion is true', () => {
    renderWithProviders(<PublishPanel {...defaultProps} hasActiveVersion={true} />);
    expect(screen.getByRole('button', { name: /rollback/i })).toBeInTheDocument();
  });

  it('hides rollback button when no active version', () => {
    renderWithProviders(<PublishPanel {...defaultProps} hasActiveVersion={false} />);
    expect(screen.queryByRole('button', { name: /rollback/i })).not.toBeInTheDocument();
  });

  it('disables rollback when canRollback is false', () => {
    renderWithProviders(<PublishPanel {...defaultProps} hasActiveVersion={true} canRollback={false} />);
    expect(screen.getByRole('button', { name: /rollback/i })).toBeDisabled();
  });

  it('shows publishing state when isPublishing', () => {
    renderWithProviders(<PublishPanel {...defaultProps} draftVersion={makeDraftVersion('validated')} isPublishing={true} />);
    expect(screen.getByRole('button', { name: /publishing/i })).toBeDisabled();
  });

  it('checklist marks validation as done when validationResult.status is passed', () => {
    const validationResult = {
      version: makeDraftVersion(),
      outcome: { status: 'passed', errors: [], warnings: [] },
    };
    renderWithProviders(<PublishPanel {...defaultProps} validationResult={validationResult} />);
    // The item label is present and the pending hint is absent
    expect(screen.getByText(/graph validation/i)).toBeInTheDocument();
    // When validation passed, no "Run Validate" hint should be shown
    expect(screen.queryByText(/run validate/i)).not.toBeInTheDocument();
  });

  it('shows the mandatory approval note for AI-suggested drafts', () => {
    renderWithProviders(
      <PublishPanel
        {...defaultProps}
        validationResult={{ version: makeDraftVersion('validated'), outcome: { status: 'passed', errors: [], warnings: [] } }}
        simulationResult={{ version: makeDraftVersion('validated'), scenario: {}, outcome: { status: 'passed', path: [], steps: [], final_action: null, errors: [] } }}
        draftVersion={{
          ...makeDraftVersion('validated'),
          metadata: {
            ai_lineage: {
              ai_assisted: true,
              requires_human_approval: true,
            },
          },
        }}
      />,
    );

    expect(screen.getByText(/human approval required for ai-suggested draft/i)).toBeInTheDocument();
  });
});
