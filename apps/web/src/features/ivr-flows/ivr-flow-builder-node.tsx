import { Handle, Position, type NodeProps } from 'reactflow';
import {
  ArrowRightLeft,
  CircleDot,
  CircleStop,
  Clock3,
  Equal,
  GitBranch,
  Mail,
  PlayCircle,
  Route,
  Tags,
  Volume2,
} from 'lucide-react';
import type { BuilderNodeData, BuilderNodeType } from './ivr-flow-builder-utils';

const toneClasses: Record<BuilderNodeType, string> = {
  start: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/8',
  play_prompt: 'border-[var(--color-info)]/30 bg-[var(--color-info)]/8',
  play_collect: 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/8',
  switch: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10',
  business_hours: 'border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10',
  caller_id_match: 'border-[var(--color-platform)]/30 bg-[var(--color-platform)]/10',
  set_variable: 'border-[var(--color-secondary)]/30 bg-[var(--color-surface-muted)]',
  transfer_extension: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10',
  queue: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10',
  voicemail_drop: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10',
  hangup: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10',
};

function NodeIcon({ type }: { type: BuilderNodeType }) {
  switch (type) {
    case 'start':
      return <PlayCircle className="size-4" aria-hidden="true" />;
    case 'play_prompt':
      return <Volume2 className="size-4" aria-hidden="true" />;
    case 'play_collect':
      return <CircleDot className="size-4" aria-hidden="true" />;
    case 'switch':
      return <GitBranch className="size-4" aria-hidden="true" />;
    case 'business_hours':
      return <Clock3 className="size-4" aria-hidden="true" />;
    case 'caller_id_match':
      return <Route className="size-4" aria-hidden="true" />;
    case 'set_variable':
      return <Tags className="size-4" aria-hidden="true" />;
    case 'transfer_extension':
      return <ArrowRightLeft className="size-4" aria-hidden="true" />;
    case 'queue':
      return <Equal className="size-4" aria-hidden="true" />;
    case 'voicemail_drop':
      return <Mail className="size-4" aria-hidden="true" />;
    case 'hangup':
      return <CircleStop className="size-4" aria-hidden="true" />;
  }
}

export function IvrFlowBuilderNode({ data, selected }: NodeProps<BuilderNodeData>) {
  const type = data.graphNode.type;

  return (
    <div
      className={[
        'min-w-[220px] rounded-[var(--radius-xl)] border p-4 shadow-[var(--shadow-card)] transition',
        toneClasses[type],
        selected ? 'ring-2 ring-[var(--color-focus)]/40' : '',
      ].join(' ')}
    >
      <Handle className="!h-3 !w-3 !border-white !bg-[var(--color-primary)]" position={Position.Left} type="target" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
            <NodeIcon type={type} />
            {data.title}
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{data.subtitle}</p>
        </div>
        <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">
          {type}
        </span>
      </div>

      {data.outputs.length > 0 ? (
        <div className="mt-4 space-y-2">
          {data.outputs.map((output) => (
            <div key={output.id} className="relative flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-surface)]/80 px-2 py-1 text-[11px] text-[var(--color-muted-fg)]">
              <span>{output.label}</span>
              <Handle
                className="!h-3 !w-3 !border-white !bg-[var(--color-tenant)]"
                id={output.id}
                position={Position.Right}
                style={{ top: '50%', transform: 'translateY(-50%)' }}
                type="source"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-surface)]/70 px-2 py-1 text-[11px] text-[var(--color-muted-fg)]">
          Terminal node
        </div>
      )}
    </div>
  );
}
