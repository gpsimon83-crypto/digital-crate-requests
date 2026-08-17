"use client";

import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface EmailPreviewModalProps {
  open: boolean;
  to: string | null;
  subject: string;
  body: string;
  signature: string | null;
  sending: boolean;
  onSend: () => void;
  onCancel: () => void;
}

// Shows exactly what will land in the client's inbox — merge-filled subject/body
// plus the sending DJ's signature — before the real send fires. Portaled like
// ConfirmModal, but wider since it's showing a full email rather than a prompt.
export function EmailPreviewModal({ open, to, subject, body, signature, sending, onSend, onCancel }: EmailPreviewModalProps) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Mail size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold">Preview email</h2>
            <p className="mt-1 text-sm text-muted">This is exactly what {to ?? "your client"} will receive.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-[10px] border border-black/10 bg-panel p-4 text-sm">
          {to && (
            <p>
              <span className="font-semibold">To: </span>
              <span className="text-muted">{to}</span>
            </p>
          )}
          <p>
            <span className="font-semibold">Subject: </span>
            <span className="text-muted">{subject || "(no subject)"}</span>
          </p>
          <div className="mt-1 whitespace-pre-wrap border-t border-black/10 pt-3">
            {body}
            {signature && <>{"\n\n"}<span className="text-muted">{signature}</span></>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Back to edit
          </Button>
          <Button variant="primary" size="sm" onClick={onSend} disabled={sending}>
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
