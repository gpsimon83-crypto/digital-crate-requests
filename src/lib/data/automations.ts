import { createAdminClient } from "@/lib/supabase/admin";

export interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals";
  value: string;
}

export type AutomationAction =
  | { type: "create_task"; title: string; dueInDays?: number }
  | { type: "notify_staff"; title: string; body?: string }
  | { type: "send_email"; templateId: string };

export interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunRow {
  id: string;
  automation_id: string;
  event_id: string | null;
  status: "ran" | "skipped" | "error";
  detail: string | null;
  actions_run: { type: string; result: string }[];
  created_at: string;
}

export async function listAutomations(): Promise<AutomationRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("automations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listActiveAutomationsForTrigger(trigger: string): Promise<AutomationRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("automations").select("*").eq("trigger", trigger).eq("is_active", true);
  if (error) throw error;
  return data;
}

export async function createAutomation(input: {
  name: string;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}): Promise<AutomationRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("automations")
    .insert({ name: input.name, trigger: input.trigger, conditions: input.conditions, actions: input.actions })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAutomation(
  id: string,
  updates: Partial<{ name: string; trigger: string; conditions: AutomationCondition[]; actions: AutomationAction[]; isActive: boolean }>
): Promise<AutomationRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.trigger !== undefined) patch.trigger = updates.trigger;
  if (updates.conditions !== undefined) patch.conditions = updates.conditions;
  if (updates.actions !== undefined) patch.actions = updates.actions;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;
  patch.updated_at = new Date().toISOString();

  const { data, error } = await db.from("automations").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAutomation(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("automations").delete().eq("id", id);
  if (error) throw error;
}

export async function listAutomationRuns(automationId: string): Promise<AutomationRunRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("automation_runs")
    .select("*")
    .eq("automation_id", automationId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function recordAutomationRun(input: {
  automationId: string;
  eventId: string | null;
  status: "ran" | "skipped" | "error";
  detail?: string;
  actionsRun?: { type: string; result: string }[];
}): Promise<void> {
  const db = createAdminClient();
  await db.from("automation_runs").insert({
    automation_id: input.automationId,
    event_id: input.eventId,
    status: input.status,
    detail: input.detail ?? null,
    actions_run: input.actionsRun ?? []
  });
}
