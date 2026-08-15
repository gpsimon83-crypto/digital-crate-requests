"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Trash2, Plus } from "lucide-react";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
}

function dueDateTone(dueDate: string | null): string {
  if (!dueDate) return "text-muted";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (due < today) return "text-status-declined";
  if (due.getTime() === today.getTime()) return "text-status-pending";
  return "text-muted";
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const due = new Date(`${dueDate}T00:00:00`);
  return `Due ${due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}

export function TasksPanel({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  function load() {
    fetch(`/api/events/${eventId}/tasks`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load tasks");
        setTasks(data.tasks);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, [eventId]);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), dueDate: newDueDate || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add task");
      setTasks((prev) => (prev ? [...prev, data.task] : [data.task]));
      setNewTitle("");
      setNewDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(task: TaskRow) {
    const completed = !task.completed_at;
    setTasks((prev) => prev?.map((t) => (t.id === task.id ? { ...t, completed_at: completed ? new Date().toISOString() : null } : t)) ?? null);
    await fetch(`/api/events/${eventId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed })
    });
  }

  async function handleDelete(task: TaskRow) {
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? null);
    await fetch(`/api/events/${eventId}/tasks/${task.id}`, { method: "DELETE" });
  }

  if (!tasks) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const open = tasks.filter((t) => !t.completed_at);
  const completed = tasks.filter((t) => t.completed_at);

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="flex flex-col gap-3">
        <p className="text-sm font-semibold">What&rsquo;s next</p>
        <p className="text-xs text-muted">Add what needs to happen to move this booking forward, and by when.</p>

        {open.length === 0 ? (
          <p className="text-sm text-muted">No open tasks.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {open.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-[10px] border border-black/10 bg-panel px-3 py-2.5">
                <button
                  onClick={() => handleToggle(task)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/20 hover:border-gold"
                  aria-label="Mark complete"
                >
                  <Check size={12} className="opacity-0 hover:opacity-40" />
                </button>
                <div className="flex-1">
                  <p className="text-sm">{task.title}</p>
                  <p className={cn("text-xs", dueDateTone(task.due_date))}>{formatDueDate(task.due_date)}</p>
                </div>
                <button onClick={() => handleDelete(task)} className="text-muted hover:text-status-declined">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="e.g. Confirm final guest count"
            className="flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding || !newTitle.trim()}>
            <Plus size={14} /> Add Task
          </Button>
        </div>

        {error && <p className="text-xs text-status-declined">{error}</p>}
      </GlassCard>

      {completed.length > 0 && (
        <div>
          <button onClick={() => setShowCompleted((v) => !v)} className="text-xs font-medium text-muted hover:text-gold">
            {showCompleted ? "Hide" : "Show"} completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="mt-2 flex flex-col gap-2">
              {completed.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-[10px] border border-black/10 bg-panel px-3 py-2.5 opacity-60">
                  <button onClick={() => handleToggle(task)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-approved text-white">
                    <Check size={12} />
                  </button>
                  <p className="flex-1 text-sm line-through">{task.title}</p>
                  <button onClick={() => handleDelete(task)} className="text-muted hover:text-status-declined">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
