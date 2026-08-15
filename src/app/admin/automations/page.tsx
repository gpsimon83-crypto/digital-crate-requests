"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/ui/status-chip";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { TRIGGERS, DATE_TRIGGER_TYPES, CONDITION_FIELDS, ACTION_TYPES, buildDateTrigger, parseDateTrigger } from "@/lib/automation-capabilities";

interface Condition {
  field: string;
  operator: "equals" | "not_equals";
  value: string;
}

type Action =
  | { type: "create_task"; title: string; dueInDays?: number }
  | { type: "notify_staff"; title: string; body?: string }
  | { type: "send_email"; templateId: string }
  | { type: "unlock_music_plan" };

interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
}

interface RunRow {
  id: string;
  status: "ran" | "skipped" | "error";
  detail: string | null;
  actions_run: { type: string; result: string }[];
  created_at: string;
}

interface EmailTemplate {
  id: string;
  title: string;
}

const inputClass = "w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

function triggerLabel(value: string) {
  const parsed = parseDateTrigger(value);
  if (parsed) {
    const typeLabel = DATE_TRIGGER_TYPES.find((t) => t.value === parsed.type)?.label ?? parsed.type;
    return `${parsed.days} ${typeLabel}`;
  }
  return TRIGGERS.find((t) => t.value === value)?.label ?? value;
}

export default function AdminAutomationsPage() {
  const [automations, setAutomations] = useState<AutomationRow[] | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/automations")
      .then((r) => r.json())
      .then((data) => setAutomations(data.automations ?? []))
      .catch(() => setAutomations([]));
    fetch("/api/admin/library?category=email_template")
      .then((r) => r.json())
      .then((data) => setTemplates((data.items ?? []).map((i: { id: string; title: string }) => ({ id: i.id, title: i.title }))))
      .catch(() => setTemplates([]));
  }

  useEffect(load, []);

  async function handleCreate(input: { name: string; trigger: string; conditions: Condition[]; actions: Action[] }) {
    setError(null);
    try {
      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setAutomations([data.automation, ...(automations ?? [])]);
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleUpdate(id: string, input: { name: string; trigger: string; conditions: Condition[]; actions: Action[] }) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setAutomations((automations ?? []).map((a) => (a.id === id ? data.automation : a)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleToggleActive(automation: AutomationRow) {
    setAutomations((automations ?? []).map((a) => (a.id === automation.id ? { ...a, is_active: !a.is_active } : a)));
    await fetch(`/api/admin/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !automation.is_active })
    });
  }

  async function handleDelete(id: string) {
    setAutomations((automations ?? []).filter((a) => a.id !== id));
    await fetch(`/api/admin/automations/${id}`, { method: "DELETE" });
  }

  return (
    <>
      <PageHeader
        title="Automations"
        subtitle="Trigger → conditions → actions, running automatically on real events."
        action={
          <Button variant="primary" size="sm" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? <X size={13} /> : <Plus size={13} />} {showAdd ? "Cancel" : "New Automation"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}

        {showAdd && <AutomationForm templates={templates} onSave={handleCreate} onCancel={() => setShowAdd(false)} />}

        {automations === null ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : automations.length === 0 ? (
          <GlassCard className="text-sm text-muted">
            No automations yet. Create one to automatically create tasks, notify staff, or send an email when something
            happens — a new lead comes in, a contract gets signed, a payment lands.
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {automations.map((automation) =>
              editingId === automation.id ? (
                <AutomationForm
                  key={automation.id}
                  templates={templates}
                  initial={automation}
                  onSave={(input) => handleUpdate(automation.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <GlassCard key={automation.id} className={cn("flex flex-col gap-2", !automation.is_active && "opacity-50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{automation.name}</p>
                      <p className="text-xs text-muted">
                        {triggerLabel(automation.trigger)}
                        {automation.conditions.length > 0 && ` · ${automation.conditions.length} condition${automation.conditions.length === 1 ? "" : "s"}`}
                        {" · "}
                        {automation.actions.length} action{automation.actions.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <button onClick={() => setEditingId(automation.id)} className="text-gold hover:underline">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleToggleActive(automation)} className="text-muted hover:underline">
                        {automation.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(automation.id)} className="text-status-declined hover:underline">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-0.5 text-xs text-muted">
                    {automation.actions.map((a, i) => (
                      <li key={i}>
                        •{" "}
                        {a.type === "create_task"
                          ? `Create task "${a.title}"`
                          : a.type === "notify_staff"
                            ? `Notify staff: "${a.title}"`
                            : a.type === "send_email"
                              ? `Send email: ${templates.find((t) => t.id === a.templateId)?.title ?? "template"}`
                              : "Unlock Wedding Music Plan in portal"}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setExpandedId(expandedId === automation.id ? null : automation.id)}
                    className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
                  >
                    {expandedId === automation.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Run history
                  </button>
                  {expandedId === automation.id && <RunHistory automationId={automation.id} />}
                </GlassCard>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}

function RunHistory({ automationId }: { automationId: string }) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);

  function load() {
    fetch(`/api/admin/automations/${automationId}/runs`)
      .then((r) => r.json())
      .then((data) => setRuns(data.runs ?? []))
      .catch(() => setRuns([]));
  }

  useEffect(load, [automationId]);

  if (runs === null) return <p className="text-xs text-muted">Loading...</p>;
  if (runs.length === 0) return <p className="text-xs text-muted">Hasn&apos;t run yet.</p>;

  return (
    <div className="flex flex-col divide-y divide-border border-t border-border text-xs">
      {runs.map((run) => (
        <div key={run.id} className="flex flex-col gap-0.5 py-2">
          <div className="flex items-center gap-2">
            <StatusChip tone={run.status === "ran" ? "approved" : run.status === "error" ? "declined" : "muted"}>
              {run.status}
            </StatusChip>
            <span className="text-muted">{new Date(run.created_at).toLocaleString()}</span>
          </div>
          {run.detail && <p className="text-muted">{run.detail}</p>}
          {run.actions_run.map((a, i) => (
            <p key={i} className="text-muted">
              → {a.result}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function AutomationForm({
  templates,
  initial,
  onSave,
  onCancel
}: {
  templates: EmailTemplate[];
  initial?: AutomationRow;
  onSave: (input: { name: string; trigger: string; conditions: Condition[]; actions: Action[] }) => void;
  onCancel: () => void;
}) {
  const initialParsedDate = initial ? parseDateTrigger(initial.trigger) : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [triggerType, setTriggerType] = useState(initialParsedDate ? initialParsedDate.type : (initial?.trigger ?? TRIGGERS[0].value));
  const [days, setDays] = useState(initialParsedDate?.days ?? 7);
  const [conditions, setConditions] = useState<Condition[]>(initial?.conditions ?? []);
  const [actions, setActions] = useState<Action[]>(initial?.actions ?? []);

  const isDateTrigger = DATE_TRIGGER_TYPES.some((t) => t.value === triggerType);

  function addCondition() {
    setConditions([...conditions, { field: CONDITION_FIELDS[0].value, operator: "equals", value: "" }]);
  }
  function updateCondition(i: number, patch: Partial<Condition>) {
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }

  function addAction() {
    setActions([...actions, { type: "create_task", title: "" }]);
  }
  function updateAction(i: number, action: Action) {
    setActions(actions.map((a, idx) => (idx === i ? action : a)));
  }
  function removeAction(i: number) {
    setActions(actions.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!name.trim()) return;
    const trigger = isDateTrigger ? buildDateTrigger(triggerType, days) : triggerType;
    onSave({ name: name.trim(), trigger, conditions: conditions.filter((c) => c.value.trim()), actions });
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Wedding lead follow-up" />
        </label>
        <label className="block">
          <span className={labelClass}>Trigger</span>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className={inputClass}>
            <optgroup label="When something happens">
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="On a schedule (checked once daily)">
              {DATE_TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {isDateTrigger && (
          <label className="block">
            <span className={labelClass}>Number of days</span>
            <input
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </label>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Conditions (optional — runs for every event if empty)</span>
          <button onClick={addCondition} className="text-xs text-gold hover:underline">
            + Add condition
          </button>
        </div>
        {conditions.map((c, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <select value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className={cn(inputClass, "w-40")}>
              {CONDITION_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={c.operator}
              onChange={(e) => updateCondition(i, { operator: e.target.value as Condition["operator"] })}
              className={cn(inputClass, "w-28")}
            >
              <option value="equals">is</option>
              <option value="not_equals">is not</option>
            </select>
            <input value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className={inputClass} placeholder="value" />
            <button onClick={() => removeCondition(i)} className="shrink-0 text-status-declined">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Actions</span>
          <button onClick={addAction} className="text-xs text-gold hover:underline">
            + Add action
          </button>
        </div>
        {actions.map((a, i) => (
          <ActionEditor key={i} action={a} templates={templates} onChange={(action) => updateAction(i, action)} onRemove={() => removeAction(i)} />
        ))}
        {actions.length === 0 && <p className="text-xs text-muted">No actions yet — add at least one for this automation to do anything.</p>}
      </div>

      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={submit} className="w-fit">
          Save
        </Button>
        <button onClick={onCancel} className="text-xs text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </GlassCard>
  );
}

function ActionEditor({
  action,
  templates,
  onChange,
  onRemove
}: {
  action: Action;
  templates: EmailTemplate[];
  onChange: (a: Action) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mb-2 flex items-start gap-2 border border-black/10 p-2.5">
      <select
        value={action.type}
        onChange={(e) => {
          const type = e.target.value as Action["type"];
          if (type === "create_task") onChange({ type, title: "" });
          else if (type === "notify_staff") onChange({ type, title: "" });
          else if (type === "unlock_music_plan") onChange({ type });
          else onChange({ type, templateId: templates[0]?.id ?? "" });
        }}
        className={cn(inputClass, "w-36 shrink-0")}
      >
        {ACTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <div className="flex-1">
        {action.type === "create_task" && (
          <div className="flex gap-2">
            <input
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
              className={inputClass}
              placeholder="Task title"
            />
            <input
              type="number"
              value={action.dueInDays ?? ""}
              onChange={(e) => onChange({ ...action, dueInDays: e.target.value ? Number(e.target.value) : undefined })}
              className={cn(inputClass, "w-28")}
              placeholder="Due in (days)"
            />
          </div>
        )}
        {action.type === "notify_staff" && (
          <div className="flex flex-col gap-2">
            <input
              value={action.title}
              onChange={(e) => onChange({ ...action, title: e.target.value })}
              className={inputClass}
              placeholder="Notification title"
            />
            <input
              value={action.body ?? ""}
              onChange={(e) => onChange({ ...action, body: e.target.value })}
              className={inputClass}
              placeholder="Body (optional)"
            />
          </div>
        )}
        {action.type === "send_email" && (
          <select value={action.templateId} onChange={(e) => onChange({ ...action, templateId: e.target.value })} className={inputClass}>
            <option value="">Select an email template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        {action.type === "send_email" && templates.length === 0 && (
          <p className="mt-1 text-xs text-muted">No email templates yet — add one in Library first.</p>
        )}
        {action.type === "unlock_music_plan" && (
          <p className="py-2 text-xs text-muted">Sets the wedding music plan as available in the client&apos;s portal (weddings only).</p>
        )}
      </div>

      <button onClick={onRemove} className="shrink-0 text-status-declined">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
