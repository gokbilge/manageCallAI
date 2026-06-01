import type { PlatformHealthSnapshot } from '@managecallai/contracts';
import type { ObservabilityRepository } from './observability.repository.js';
import type {
  AlertListFilter,
  AlertRuleListFilter,
  CreateAlertRuleInput,
  LiveSnapshot,
  SecurityAlertInstance,
  SecurityAlertRule,
  UpdateAlertRuleInput,
} from './observability.types.js';

export class AlertRuleNotFoundError extends Error {
  constructor(id: string) {
    super(`Alert rule not found: ${id}`);
    this.name = 'AlertRuleNotFoundError';
  }
}

export class AlertNotFoundError extends Error {
  constructor(id: string) {
    super(`Alert not found or cannot be updated: ${id}`);
    this.name = 'AlertNotFoundError';
  }
}

const HEALTH_TIMEOUT_MS = 3000;

export class ObservabilityService {
  constructor(private readonly repo: ObservabilityRepository) {}

  getSnapshot(tenantId: string): Promise<LiveSnapshot> {
    return this.repo.getSnapshot(tenantId);
  }

  async getPlatformHealth(
    checks: Array<{ name: string; url: string }>,
  ): Promise<PlatformHealthSnapshot> {
    const [services, summary] = await Promise.all([
      Promise.all(checks.map(checkService)),
      this.repo.getPlatformRuntimeSummary(),
    ]);
    return {
      services,
      active_sessions_total: summary.active_sessions,
      completed_sessions_24h: summary.completed_sessions_24h,
      failed_sessions_24h: summary.failed_sessions_24h,
      generated_at: new Date().toISOString(),
    };
  }

  // ── SLICE-48: Security alert rules ───────────────────────────────────────

  async listAlertRules(tenantId: string, filter: AlertRuleListFilter): Promise<SecurityAlertRule[]> {
    return this.repo.listAlertRules(tenantId, filter);
  }

  async createAlertRule(tenantId: string, createdBy: string, input: CreateAlertRuleInput): Promise<SecurityAlertRule> {
    return this.repo.createAlertRule(tenantId, createdBy, input);
  }

  async updateAlertRule(id: string, tenantId: string, input: UpdateAlertRuleInput): Promise<SecurityAlertRule> {
    const rule = await this.repo.updateAlertRule(id, tenantId, input);
    if (!rule) throw new AlertRuleNotFoundError(id);
    return rule;
  }

  async deleteAlertRule(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteAlertRule(id, tenantId);
    if (!deleted) throw new AlertRuleNotFoundError(id);
  }

  // ── SLICE-48: Alert instances ─────────────────────────────────────────────

  async listAlerts(tenantId: string, filter: AlertListFilter): Promise<SecurityAlertInstance[]> {
    return this.repo.listAlerts(tenantId, filter);
  }

  async acknowledgeAlert(id: string, tenantId: string, userId: string): Promise<SecurityAlertInstance> {
    const alert = await this.repo.acknowledgeAlert(id, tenantId, userId);
    if (!alert) throw new AlertNotFoundError(id);
    return alert;
  }

  async resolveAlert(id: string, tenantId: string): Promise<SecurityAlertInstance> {
    const alert = await this.repo.resolveAlert(id, tenantId);
    if (!alert) throw new AlertNotFoundError(id);
    return alert;
  }

  async dismissAlert(id: string, tenantId: string): Promise<SecurityAlertInstance> {
    const alert = await this.repo.dismissAlert(id, tenantId);
    if (!alert) throw new AlertNotFoundError(id);
    return alert;
  }

  // ── SLICE-48: Rule evaluation ─────────────────────────────────────────────
  // Evaluates all active rules for a tenant and fires alerts for triggered rules.
  // Default cooldown: 15 minutes per rule to prevent alert spam.

  async evaluateAllRules(tenantId: string, cooldownMinutes = 15): Promise<SecurityAlertInstance[]> {
    const rules = await this.repo.listAlertRules(tenantId, { status: 'active' });
    const fired: SecurityAlertInstance[] = [];

    for (const rule of rules) {
      const cooled = await this.repo.isCooledDown(rule.id, tenantId, cooldownMinutes);
      if (cooled) continue;

      const result = await this.evaluateRule(tenantId, rule);
      if (result) fired.push(result);
    }

    return fired;
  }

  private async evaluateRule(tenantId: string, rule: SecurityAlertRule): Promise<SecurityAlertInstance | null> {
    const c = rule.conditions as Record<string, unknown>;

    switch (rule.alert_type) {
      case 'failed_sip_registration': {
        const threshold = typeof c['threshold'] === 'number' ? c['threshold'] : 5;
        const windowMinutes = typeof c['window_minutes'] === 'number' ? c['window_minutes'] : 10;
        const count = await this.repo.countFailedSipRegistrations(tenantId, windowMinutes);
        if (count < threshold) return null;
        return this.repo.createAlert({
          tenant_id: tenantId,
          rule_id: rule.id,
          alert_type: rule.alert_type,
          severity: rule.severity,
          message: `${count} SIP authentication failures detected in the last ${windowMinutes} minutes (threshold: ${threshold})`,
          context_json: { count, window_minutes: windowMinutes, threshold },
        });
      }

      case 'outbound_call_burst': {
        const threshold = typeof c['threshold'] === 'number' ? c['threshold'] : 20;
        const windowMinutes = typeof c['window_minutes'] === 'number' ? c['window_minutes'] : 1;
        const count = await this.repo.countRecentCallEvents(tenantId, windowMinutes, 'outbound');
        if (count < threshold) return null;
        return this.repo.createAlert({
          tenant_id: tenantId,
          rule_id: rule.id,
          alert_type: rule.alert_type,
          severity: rule.severity,
          message: `${count} outbound calls dispatched in the last ${windowMinutes} minute(s) (threshold: ${threshold})`,
          context_json: { count, window_minutes: windowMinutes, threshold },
        });
      }

      case 'runtime_auth_failure': {
        // Proxy via call events that represent auth-rejected inbound attempts
        const threshold = typeof c['threshold'] === 'number' ? c['threshold'] : 5;
        const windowMinutes = typeof c['window_minutes'] === 'number' ? c['window_minutes'] : 5;
        const count = await this.repo.countFailedSipRegistrations(tenantId, windowMinutes);
        if (count < threshold) return null;
        return this.repo.createAlert({
          tenant_id: tenantId,
          rule_id: rule.id,
          alert_type: rule.alert_type,
          severity: rule.severity,
          message: `${count} runtime authentication failures in the last ${windowMinutes} minutes (threshold: ${threshold})`,
          context_json: { count, window_minutes: windowMinutes, threshold },
        });
      }

      case 'webhook_delivery_backlog': {
        const maxFailed = typeof c['max_failed'] === 'number' ? c['max_failed'] : 10;
        const maxAbandoned = typeof c['max_abandoned'] === 'number' ? c['max_abandoned'] : 5;
        const backlog = await this.repo.countWebhookBacklog(tenantId);
        if (backlog.failed < maxFailed && backlog.abandoned < maxAbandoned) return null;
        return this.repo.createAlert({
          tenant_id: tenantId,
          rule_id: rule.id,
          alert_type: rule.alert_type,
          severity: rule.severity,
          message: `Webhook delivery backlog: ${backlog.failed} failed, ${backlog.abandoned} abandoned`,
          context_json: { ...backlog, max_failed: maxFailed, max_abandoned: maxAbandoned },
        });
      }

      case 'recording_analysis_backlog': {
        const maxQueued = typeof c['max_queued'] === 'number' ? c['max_queued'] : 50;
        const ageMinutes = typeof c['age_minutes'] === 'number' ? c['age_minutes'] : 60;
        const count = await this.repo.countOldAnalysisJobs(tenantId, ageMinutes);
        if (count < maxQueued) return null;
        return this.repo.createAlert({
          tenant_id: tenantId,
          rule_id: rule.id,
          alert_type: rule.alert_type,
          severity: rule.severity,
          message: `${count} recording analysis jobs older than ${ageMinutes} minutes are still queued or processing`,
          context_json: { count, age_minutes: ageMinutes, max_queued: maxQueued },
        });
      }

      case 'unknown_destination_call':
        return null;

      default:
        return null;
    }
  }
}

async function checkService({ name, url }: { name: string; url: string }) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    const detail = (await response.text()).slice(0, 200);
    return { name, url, status: (response.ok ? 'healthy' : 'degraded') as 'healthy' | 'degraded' | 'unreachable', detail };
  } catch {
    clearTimeout(id);
    return { name, url, status: 'unreachable' as const, detail: 'connection failed' };
  }
}
