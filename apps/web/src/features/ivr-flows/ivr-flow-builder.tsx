import { useEffect, useMemo, useState } from 'react';
import type { Node, NodeChange, OnNodesChange } from 'reactflow';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BUILDER_NODE_TYPES,
  addBuilderNode,
  builderStateToGraph,
  connectBuilderNodes,
  disconnectBuilderEdge,
  type BuilderGraphNode,
  type BuilderNodeData,
  graphToBuilderEdges,
  graphToBuilderNodes,
  sanitizeBuilderGraph,
  updateBuilderNode,
} from './ivr-flow-builder-utils';
import { IvrFlowBuilderNode } from './ivr-flow-builder-node';
import type { ExtensionOption, FlowVersion, PromptAssetOption } from '@/lib/ivr-flows/ivr-flows-api';

const nodeTypes = { ivrNode: IvrFlowBuilderNode };

type IvrFlowBuilderProps = {
  version: FlowVersion;
  prompts: PromptAssetOption[];
  extensions: ExtensionOption[];
  onSave: (graph_json: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
};

export function IvrFlowBuilder({ version, prompts, extensions, onSave, isSaving }: IvrFlowBuilderProps) {
  const [nodes, setNodes] = useState<Node<BuilderNodeData>[]>(() => graphToBuilderNodes(sanitizeBuilderGraph(version.graph_json)));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setNodes(graphToBuilderNodes(sanitizeBuilderGraph(version.graph_json)));
    setSelectedNodeId(null);
    setIsDirty(false);
  }, [version.id, version.graph_json]);

  const edges = useMemo(() => graphToBuilderEdges(builderStateToGraph(nodes)), [nodes]);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const nodeOptions = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: `${node.data.title} (${node.id})` })),
    [nodes],
  );

  const onNodesChange: OnNodesChange = (changes) => {
    setNodes((current) => applyNodeChanges(changes as NodeChange[], current));
    if (changes.length > 0) setIsDirty(true);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.26fr_1fr_0.4fr]">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Node Palette</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
            Add only the current MVP runtime node types. The builder stays aligned to the safe backend schema.
          </p>
        </div>
        <div className="space-y-3">
          {BUILDER_NODE_TYPES.map((entry) => (
            <button
              key={entry.type}
              className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-left transition hover:border-[var(--color-tenant)]/40 hover:bg-[var(--color-surface)]"
              onClick={() => {
                setNodes((current) => addBuilderNode(current, entry.type));
                setIsDirty(true);
              }}
              type="button"
            >
              <p className="text-sm font-medium text-[var(--color-fg)]">{entry.label}</p>
              <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{entry.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Visual Builder</h2>
            <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
              Drag nodes, connect typed edges, and save changes back to the current draft version.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${isDirty ? 'bg-[var(--color-warning)]/12 text-[var(--color-warning)]' : 'bg-[var(--color-success)]/12 text-[var(--color-success)]'}`}>
              {isDirty ? 'Unsaved changes' : 'Draft saved'}
            </span>
            <Button
              disabled={!isDirty || isSaving}
              onClick={() => void onSave(builderStateToGraph(nodes))}
              type="button"
            >
              <Save className="size-4" aria-hidden="true" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </div>

        <div className="h-[760px] bg-[linear-gradient(180deg,rgba(8,145,178,0.05),transparent)]">
          <ReactFlow
            edges={edges}
            fitView
            minZoom={0.5}
            nodes={nodes}
            nodeTypes={nodeTypes}
            onConnect={(connection) => {
              if (!connection.source || !connection.target) return;
              setNodes((current) => connectBuilderNodes(current, connection.source!, connection.sourceHandle, connection.target!));
              setIsDirty(true);
            }}
            onEdgesDelete={(deletedEdges) => {
              setNodes((current) => deletedEdges.reduce((acc, edge) => disconnectBuilderEdge(acc, edge), current));
              if (deletedEdges.length > 0) setIsDirty(true);
            }}
            onNodesChange={onNodesChange}
            onSelectionChange={({ nodes: selected }) => {
              setSelectedNodeId(selected[0]?.id ?? null);
            }}
          >
            <MiniMap
              maskColor="rgba(15, 23, 42, 0.04)"
              nodeBorderRadius={12}
              nodeColor={() => '#cbd5e1'}
              pannable
            />
            <Controls />
            <Background color="#dbeafe" gap={20} size={1} />
          </ReactFlow>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Node Inspector</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
            Edit node settings without dropping down to raw JSON.
          </p>
        </div>

        {selectedNode ? (
          <NodeInspector
            extensions={extensions}
            node={selectedNode}
            nodeOptions={nodeOptions}
            prompts={prompts}
            onDelete={() => {
              setNodes((current) => removeNode(current, selectedNode.id));
              setSelectedNodeId(null);
              setIsDirty(true);
            }}
            onUpdate={(patch) => {
              setNodes((current) => current.map((node) => node.id === selectedNode.id ? updateBuilderNode(node, patch) : node));
              setIsDirty(true);
            }}
          />
        ) : (
          <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
            Select a node to edit its configuration, route targets, and branch behavior.
          </div>
        )}
      </section>
    </div>
  );
}

function removeNode(nodes: Node<BuilderNodeData>[], nodeId: string): Node<BuilderNodeData>[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => {
      const graphNode = node.data.graphNode;
      if ('next_node_id' in graphNode && graphNode.next_node_id === nodeId) {
        return updateBuilderNode(node, { next_node_id: undefined } as Partial<BuilderGraphNode>);
      }
      if (graphNode.type === 'play_collect') {
        const patch: { timeout_node_id?: undefined; invalid_node_id?: undefined } = {};
        if (graphNode.timeout_node_id === nodeId) patch.timeout_node_id = undefined;
        if (graphNode.invalid_node_id === nodeId) patch.invalid_node_id = undefined;
        if (Object.keys(patch).length > 0) return updateBuilderNode(node, patch as Partial<BuilderGraphNode>);
      }
      if (graphNode.type === 'switch') {
        const nextCases = Object.fromEntries(Object.entries(graphNode.cases ?? {}).filter(([, targetId]) => targetId !== nodeId));
        const patch: { default_node_id?: undefined; cases?: Record<string, string> } = {};
        if (graphNode.default_node_id === nodeId) patch.default_node_id = undefined;
        if (Object.keys(nextCases).length !== Object.keys(graphNode.cases ?? {}).length) patch.cases = nextCases;
        if (Object.keys(patch).length > 0) return updateBuilderNode(node, patch as Partial<BuilderGraphNode>);
      }
      return node;
    });
}

function NodeInspector({
  node,
  prompts,
  extensions,
  nodeOptions,
  onUpdate,
  onDelete,
}: {
  node: Node<BuilderNodeData>;
  prompts: PromptAssetOption[];
  extensions: ExtensionOption[];
  nodeOptions: Array<{ id: string; label: string }>;
  onUpdate: (patch: Partial<BuilderGraphNode>) => void;
  onDelete: () => void;
}) {
  const graphNode = node.data.graphNode;

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-muted)] px-4 py-4">
        <p className="font-medium text-[var(--color-fg)]">{node.data.title}</p>
        <p className="mt-1 font-mono text-xs text-[var(--color-muted-fg)]">{node.id}</p>
      </div>

      {('next_node_id' in graphNode) ? (
        <SelectField
          label="Next node"
          onChange={(value) => onUpdate({ next_node_id: value || undefined } as Partial<BuilderGraphNode>)}
          options={nodeOptions}
          value={graphNode.next_node_id ?? ''}
        />
      ) : null}

      {graphNode.type === 'play_prompt' || graphNode.type === 'play_collect' ? (
        <SelectField
          label="Prompt asset"
          onChange={(value) => onUpdate({ prompt_id: value || undefined })}
          options={prompts.map((prompt) => ({
            id: prompt.id,
            label: `${prompt.name}${prompt.language ? ` (${prompt.language})` : ''}`,
          }))}
          value={graphNode.prompt_id ?? ''}
        />
      ) : null}

      {graphNode.type === 'play_collect' ? (
        <>
          <NumberField label="Max digits" onChange={(value) => onUpdate({ max_digits: value || 1 })} value={graphNode.max_digits ?? 1} />
          <NumberField label="Timeout (ms)" onChange={(value) => onUpdate({ timeout_ms: value || 5000 })} value={graphNode.timeout_ms ?? 5000} />
          <NumberField label="Retries" onChange={(value) => onUpdate({ retries: value || 0 })} value={graphNode.retries ?? 0} />
          <SelectField
            label="Timeout target"
            onChange={(value) => onUpdate({ timeout_node_id: value || undefined })}
            options={nodeOptions}
            value={graphNode.timeout_node_id ?? ''}
          />
          <SelectField
            label="Invalid target"
            onChange={(value) => onUpdate({ invalid_node_id: value || undefined })}
            options={nodeOptions}
            value={graphNode.invalid_node_id ?? ''}
          />
        </>
      ) : null}

      {graphNode.type === 'switch' ? (
        <>
          <TextField label="Input expression" onChange={(value) => onUpdate({ input: value || '{{last_digits}}' })} value={graphNode.input ?? '{{last_digits}}'} />
          <SelectField
            label="Default target"
            onChange={(value) => onUpdate({ default_node_id: value || undefined })}
            options={nodeOptions}
            value={graphNode.default_node_id ?? ''}
          />
          <div className="space-y-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium text-[var(--color-fg)]">Switch cases</p>
              <Button
                onClick={() => {
                  const nextCases = { ...(graphNode.cases ?? {}) };
                  let caseKey = '1';
                  let counter = 1;
                  while (Object.prototype.hasOwnProperty.call(nextCases, caseKey)) {
                    counter += 1;
                    caseKey = String(counter);
                  }
                  nextCases[caseKey] = '';
                  onUpdate({ cases: nextCases });
                }}
                type="button"
                variant="secondary"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add case
              </Button>
            </div>
            {Object.entries(graphNode.cases ?? {}).map(([caseKey, targetId]) => (
              <div key={caseKey} className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                <TextField
                  label="Case key"
                  onChange={(value) => {
                    const nextCases = { ...(graphNode.cases ?? {}) };
                    const preservedTarget = nextCases[caseKey];
                    delete nextCases[caseKey];
                    nextCases[value || caseKey] = preservedTarget;
                    onUpdate({ cases: nextCases });
                  }}
                  value={caseKey}
                />
                <SelectField
                  label="Target node"
                  onChange={(value) => {
                    onUpdate({
                      cases: {
                        ...(graphNode.cases ?? {}),
                        [caseKey]: value,
                      },
                    });
                  }}
                  options={nodeOptions}
                  value={targetId ?? ''}
                />
                <Button
                  className="justify-center"
                  onClick={() => {
                    const nextCases = { ...(graphNode.cases ?? {}) };
                    delete nextCases[caseKey];
                    onUpdate({ cases: nextCases });
                  }}
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove case
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {graphNode.type === 'transfer_extension' ? (
        <SelectField
          label="Extension target"
          onChange={(value) => onUpdate({ extension_id: value || undefined })}
          options={extensions.map((extension) => ({
            id: extension.id,
            label: `${extension.extension_number} — ${extension.display_name}`,
          }))}
          value={graphNode.extension_id ?? ''}
        />
      ) : null}

      <Button className="w-full justify-center" onClick={onDelete} type="button" variant="destructive">
        <Trash2 className="size-4" aria-hidden="true" />
        Remove node
      </Button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</span>
      <select
        className={fieldClassName}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</span>
      <input
        className={fieldClassName}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</span>
      <input
        className={fieldClassName}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

const fieldClassName =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
