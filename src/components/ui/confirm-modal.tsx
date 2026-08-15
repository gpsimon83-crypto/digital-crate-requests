"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces native window.confirm() for destructive actions — same
 * "are you sure" gate, but styled like the rest of the app instead of
 * a browser-chrome dialog. Portaled to document.body.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-declined/10 text-status-declined">
              <AlertTriangle size={18} />
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {body && <p className="mt-1 text-sm text-muted">{body}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
