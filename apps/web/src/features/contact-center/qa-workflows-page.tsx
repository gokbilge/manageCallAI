import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, RefreshCcw, ShieldCheck, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { StatCard } from '@/components/data/stat-card';
import { Button } from '@/components/ui/button';
import { useQueueOptions } from '@/lib/ivr-flows/ivr-flows-api';
import {
  useAgentProfiles,
  useCallDisposition,
  useCreateQaReview,
  useCreateQaScorecard,
  useQaReviews,
  useQaScorecards,
  useUpdateQaReview,
  useUpdateQaScorecard,
  type QaReview,
  type QaReviewScore,
  type QaScorecard,
  type QaScorecardCriterion,
} from '@/lib/contact-center/contact-center-api';

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-tenant)]/40';

type ScorecardDraft = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  criteria: QaScorecardCriterion[];
};

type ReviewDraft = {
  call_id: string;
  queue_id: string;
  agent_profile_id: string;
  recording_id: string;
  scorecard_id: string;
  status: 'draft' | 'completed';
  note_text: string;
};

export function QaWorkflowsPage() {
  const scorecardsQuery = useQaScorecards();
  const reviewsQuery = useQaReviews();
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedReviewId && reviewsQuery.data && reviewsQuery.data.length > 0) {
      setSelectedReviewId(reviewsQuery.data[0]!.id);
    }
  }, [reviewsQuery.data, selectedReviewId]);

  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) ?? reviews[0] ?? null;
  const scorecards = scorecardsQuery.data ?? [];

  const stats = useMemo(() => {
    const completed = reviews.filter((review) => review.status === 'completed' || review.status === 'acknowledged');
    const average = completed.length === 0
      ? null
      : Math.round((completed.reduce((sum, review) => sum + ((review.total_score / Math.max(review.max_score, 1)) * 100), 0) / completed.length) * 100) / 100;
    return {
      scorecards: scorecards.length,
      open: reviews.filter((review) => review.status !== 'acknowledged').length,
      completed: completed.length,
      average,
    };
  }, [reviews, scorecards.length]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact Center"
        title="QA Scoring Workflow"
        description="Manual QA comes first: supervisors define scorecards, review calls, and acknowledge coaching outcomes before any AI scoring layer."
        actions={(
          <Button
            onClick={() => {
              void scorecardsQuery.refetch();
              void reviewsQuery.refetch();
            }}
            variant="secondary"
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Scorecards" value={String(stats.scorecards)} icon={ClipboardList} tone="tenant" />
        <StatCard title="Open Reviews" value={String(stats.open)} icon={ShieldCheck} tone="tenant" />
        <StatCard title="Completed" value={String(stats.completed)} icon={CheckCircle2} tone="success" />
        <StatCard title="Avg Score %" value={stats.average == null ? 'n/a' : `${stats.average}%`} icon={Star} tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ScorecardPanel />
        <ReviewsPanel selectedReviewId={selectedReview?.id ?? null} onSelectReview={setSelectedReviewId} />
      </div>
    </div>
  );
}

function ScorecardPanel() {
  const scorecardsQuery = useQaScorecards();
  const createScorecard = useCreateQaScorecard();
  const updateScorecard = useUpdateQaScorecard();
  const [editingScorecardId, setEditingScorecardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScorecardDraft>({
    name: '',
    description: '',
    status: 'active',
    criteria: [
      { key: 'greeting', label: 'Greeting', description: 'Clear opening and customer greeting', max_score: 5 },
      { key: 'resolution', label: 'Resolution', description: 'Resolved the issue or set a clear next action', max_score: 5 },
    ],
  });

  function addCriterion() {
    setDraft((current) => ({
      ...current,
      criteria: [...current.criteria, { key: '', label: '', description: '', max_score: 5 }],
    }));
  }

  function updateCriterion(index: number, field: keyof QaScorecardCriterion, value: string | number) {
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion, currentIndex) => currentIndex === index
        ? { ...criterion, [field]: value }
        : criterion),
    }));
  }

  function create() {
    void createScorecard.mutateAsync({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      criteria_json: draft.criteria.map((criterion) => ({
        key: criterion.key.trim(),
        label: criterion.label.trim(),
        description: criterion.description?.trim() || null,
        max_score: Number(criterion.max_score),
      })),
    }).then(() => {
      setDraft({
        name: '',
        description: '',
        status: 'active',
        criteria: [{ key: 'greeting', label: 'Greeting', description: 'Clear opening and customer greeting', max_score: 5 }],
      });
    });
  }

  return (
    <DataCard
      title="QA Scorecards"
      description="Criteria are explicit and auditable. The review form derives its scoring controls directly from the active scorecard."
    >
      <div className="space-y-4">
        {(scorecardsQuery.data ?? []).map((scorecard) => (
          <ScorecardRow
            key={scorecard.id}
            scorecard={scorecard}
            editing={editingScorecardId === scorecard.id}
            onToggleEdit={() => setEditingScorecardId((current) => current === scorecard.id ? null : scorecard.id)}
            onSave={(input) => void updateScorecard.mutateAsync({ id: scorecard.id, input }).then(() => setEditingScorecardId(null))}
          />
        ))}
      </div>

      <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <p className="text-sm font-medium">Create scorecard</p>
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Name
            <input className={inputClass} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Description
            <textarea className={inputClass} rows={2} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="space-y-3">
            {draft.criteria.map((criterion, index) => (
              <div key={`${criterion.key}-${index}`} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <input
                  className={inputClass}
                  placeholder="criterion key"
                  value={criterion.key}
                  onChange={(event) => updateCriterion(index, 'key', event.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder="criterion label"
                  value={criterion.label}
                  onChange={(event) => updateCriterion(index, 'label', event.target.value)}
                />
                <textarea
                  className={inputClass}
                  placeholder="criterion description"
                  rows={2}
                  value={criterion.description ?? ''}
                  onChange={(event) => updateCriterion(index, 'description', event.target.value)}
                />
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={100}
                  value={criterion.max_score}
                  onChange={(event) => updateCriterion(index, 'max_score', Number(event.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={addCriterion}>Add criterion</Button>
            <Button
              onClick={create}
              disabled={createScorecard.isPending || !draft.name.trim() || draft.criteria.some((criterion) => !criterion.key.trim() || !criterion.label.trim())}
            >
              {createScorecard.isPending ? 'Creating...' : 'Create scorecard'}
            </Button>
          </div>
        </div>
      </div>
    </DataCard>
  );
}

function ScorecardRow({
  scorecard,
  editing,
  onToggleEdit,
  onSave,
}: {
  scorecard: QaScorecard;
  editing: boolean;
  onToggleEdit: () => void;
  onSave: (input: { status: 'active' | 'inactive' }) => void;
}) {
  const [status, setStatus] = useState<'active' | 'inactive'>(scorecard.status);
  const maxScore = scorecard.criteria_json.reduce((sum, criterion) => sum + criterion.max_score, 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{scorecard.name}</p>
          <p className="text-xs text-[var(--color-muted-fg)]">{scorecard.description ?? 'No description'} · max score {maxScore}</p>
        </div>
        <Button variant="secondary" onClick={onToggleEdit}>{editing ? 'Cancel' : 'Edit status'}</Button>
      </div>
      <ul className="mt-3 space-y-2">
        {scorecard.criteria_json.map((criterion) => (
          <li key={criterion.key} className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{criterion.label}</span>
              <span className="text-xs text-[var(--color-muted-fg)]">max {criterion.max_score}</span>
            </div>
            {criterion.description && <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{criterion.description}</p>}
          </li>
        ))}
      </ul>
      {editing && (
        <div className="mt-3 flex items-center gap-2">
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <Button onClick={() => onSave({ status })}>Save</Button>
        </div>
      )}
    </div>
  );
}

function ReviewsPanel({
  selectedReviewId,
  onSelectReview,
}: {
  selectedReviewId: string | null;
  onSelectReview: (id: string) => void;
}) {
  const queueOptionsQuery = useQueueOptions();
  const agentProfilesQuery = useAgentProfiles();
  const scorecardsQuery = useQaScorecards();
  const reviewsQuery = useQaReviews();
  const createReview = useCreateQaReview();
  const updateReview = useUpdateQaReview();
  const [draft, setDraft] = useState<ReviewDraft>({
    call_id: '',
    queue_id: '',
    agent_profile_id: '',
    recording_id: '',
    scorecard_id: '',
    status: 'completed',
    note_text: '',
  });
  const selectedScorecard = scorecardsQuery.data?.find((scorecard) => scorecard.id === draft.scorecard_id) ?? scorecardsQuery.data?.[0] ?? null;
  const dispositionQuery = useCallDisposition(draft.call_id.trim() || null);

  useEffect(() => {
    if (!draft.scorecard_id && scorecardsQuery.data && scorecardsQuery.data.length > 0) {
      setDraft((current) => ({ ...current, scorecard_id: scorecardsQuery.data[0]!.id }));
    }
  }, [draft.scorecard_id, scorecardsQuery.data]);

  const [scores, setScores] = useState<Record<string, { score: string; note: string }>>({});

  useEffect(() => {
    if (!selectedScorecard) return;
    setScores((current) => {
      const next: Record<string, { score: string; note: string }> = {};
      for (const criterion of selectedScorecard.criteria_json) {
        next[criterion.key] = current[criterion.key] ?? { score: String(criterion.max_score), note: '' };
      }
      return next;
    });
  }, [selectedScorecard]);

  useEffect(() => {
    if (dispositionQuery.data?.id) {
      setDraft((current) => ({
        ...current,
        queue_id: current.queue_id || dispositionQuery.data?.queue_id || '',
        agent_profile_id: current.agent_profile_id || dispositionQuery.data?.agent_profile_id || '',
      }));
    }
  }, [dispositionQuery.data]);

  function buildScores(criteria: QaScorecardCriterion[]): QaReviewScore[] {
    return criteria.map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      score: Number(scores[criterion.key]?.score ?? criterion.max_score),
      max_score: criterion.max_score,
      note: scores[criterion.key]?.note?.trim() || null,
    }));
  }

  function create() {
    if (!selectedScorecard) return;
    void createReview.mutateAsync({
      call_id: draft.call_id.trim(),
      queue_id: draft.queue_id || null,
      agent_profile_id: draft.agent_profile_id || null,
      recording_id: draft.recording_id.trim() || null,
      disposition_id: dispositionQuery.data?.id ?? null,
      scorecard_id: selectedScorecard.id,
      scores_json: buildScores(selectedScorecard.criteria_json),
      note_text: draft.note_text.trim() || null,
      status: draft.status,
    }).then((review) => {
      onSelectReview(review.id);
      setDraft({
        call_id: '',
        queue_id: '',
        agent_profile_id: '',
        recording_id: '',
        scorecard_id: selectedScorecard.id,
        status: 'completed',
        note_text: '',
      });
    });
  }

  const reviews = reviewsQuery.data ?? [];
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) ?? reviews[0] ?? null;

  return (
    <DataCard
      title="Reviews"
      description="Reviews stay draftable, auditable, and explicitly acknowledged after coaching."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.95fr)]">
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
              No QA reviews exist yet. Create the first scored review from a handled call.
            </div>
          ) : reviews.map((review) => (
            <button
              key={review.id}
              className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left ${selectedReview?.id === review.id ? 'border-[var(--color-tenant)] bg-[var(--color-tenant)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
              onClick={() => onSelectReview(review.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{review.call_id}</p>
                  <p className="text-xs text-[var(--color-muted-fg)]">status {review.status} · score {review.total_score}/{review.max_score}</p>
                </div>
                <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold">
                  {Math.round((review.total_score / Math.max(review.max_score, 1)) * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <p className="text-sm font-medium">Create review</p>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Call ID
                <input className={inputClass} value={draft.call_id} onChange={(event) => setDraft((current) => ({ ...current, call_id: event.target.value }))} />
              </label>
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Scorecard
                <select className={inputClass} value={draft.scorecard_id} onChange={(event) => setDraft((current) => ({ ...current, scorecard_id: event.target.value }))}>
                  {(scorecardsQuery.data ?? []).map((scorecard) => (
                    <option key={scorecard.id} value={scorecard.id}>{scorecard.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Queue
                <select className={inputClass} value={draft.queue_id} onChange={(event) => setDraft((current) => ({ ...current, queue_id: event.target.value }))}>
                  <option value="">Unspecified</option>
                  {(queueOptionsQuery.data ?? []).map((queue) => (
                    <option key={queue.id} value={queue.id}>{queue.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Agent
                <select className={inputClass} value={draft.agent_profile_id} onChange={(event) => setDraft((current) => ({ ...current, agent_profile_id: event.target.value }))}>
                  <option value="">Unspecified</option>
                  {(agentProfilesQuery.data ?? []).filter((profile) => profile.status === 'active').map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.display_name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Linked disposition
                <input
                  className={inputClass}
                  disabled
                  value={dispositionQuery.data?.disposition_label ?? dispositionQuery.data?.disposition_code ?? 'None linked for this call'}
                />
              </label>
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Recording ID
                <input className={inputClass} value={draft.recording_id} onChange={(event) => setDraft((current) => ({ ...current, recording_id: event.target.value }))} />
              </label>
              {selectedScorecard && (
                <div className="space-y-2">
                  {selectedScorecard.criteria_json.map((criterion) => (
                    <div key={criterion.key} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{criterion.label}</p>
                          {criterion.description && <p className="text-xs text-[var(--color-muted-fg)]">{criterion.description}</p>}
                        </div>
                        <input
                          className={`${inputClass} w-24`}
                          type="number"
                          min={0}
                          max={criterion.max_score}
                          value={scores[criterion.key]?.score ?? String(criterion.max_score)}
                          onChange={(event) => setScores((current) => ({
                            ...current,
                            [criterion.key]: { score: event.target.value, note: current[criterion.key]?.note ?? '' },
                          }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
                Review notes
                <textarea className={inputClass} rows={3} value={draft.note_text} onChange={(event) => setDraft((current) => ({ ...current, note_text: event.target.value }))} />
              </label>
              <Button onClick={create} disabled={createReview.isPending || !draft.call_id.trim() || !selectedScorecard}>
                {createReview.isPending ? 'Creating...' : 'Create review'}
              </Button>
            </div>
          </div>

          {selectedReview && (
            <SelectedReviewCard review={selectedReview} onAcknowledge={(id) => void updateReview.mutateAsync({ id, input: { status: 'acknowledged' } })} />
          )}
        </div>
      </div>
    </DataCard>
  );
}

function SelectedReviewCard({
  review,
  onAcknowledge,
}: {
  review: QaReview;
  onAcknowledge: (id: string) => void;
}) {
  const percent = Math.round((review.total_score / Math.max(review.max_score, 1)) * 100);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Selected review</p>
          <p className="text-xs text-[var(--color-muted-fg)]">Call {review.call_id} · {review.status}</p>
        </div>
        <span className="rounded-full bg-[var(--color-tenant)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-tenant)]">
          {percent}%
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {review.scores_json.map((score) => (
          <div key={score.key} className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{score.label}</span>
              <span className="font-semibold">{score.score}/{score.max_score}</span>
            </div>
            {score.note && <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{score.note}</p>}
          </div>
        ))}
      </div>
      {review.note_text && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-muted-fg)]">
          {review.note_text}
        </div>
      )}
      {review.status !== 'acknowledged' && (
        <div className="mt-4">
          <Button onClick={() => onAcknowledge(review.id)}>Mark acknowledged</Button>
        </div>
      )}
    </div>
  );
}
