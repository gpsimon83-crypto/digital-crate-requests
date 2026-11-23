"use client";

import { useState } from "react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldRow, INPUT } from "@/components/layout/grid";

export type EditableContact = {
  id: string;
  type?: string | null;
  status: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
  partner_phone?: string | null;
  married_last_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  referral_source: string | null;
};

const KEYS = ["first_name", "last_name", "company_name", "email", "phone", "partner_first_name", "partner_last_name", "partner_phone", "married_last_name", "address_line1", "address_line2", "city", "state", "postal_code", "referral_source", "status"] as const;
type Key = (typeof KEYS)[number];

/**
 * Edit a contact's details. Saves only what changed, through the contacts
 * API (which accepts only these fields). Projects show the new details
 * straight away since they read the contact record.
 */
export function ContactEditDrawer({ contact, open, onClose, onSaved }: { contact: EditableContact; open: boolean; onClose: () => void; onSaved: (c: EditableContact) => void }) {
  const initial = Object.fromEntries(KEYS.map((k) => [k, (contact[k as keyof EditableContact] as string | null | undefined) ?? ""])) as Record<Key, string>;
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD((cur) => ({ ...cur, [k]: e.target.value }));

  async function save() {
    if (!d.first_name.trim() && !d.last_name.trim() && !d.company_name.trim()) return setErr("Give the contact a name or a company.");
    const changed = Object.fromEntries(KEYS.filter((k) => d[k].trim() !== initial[k].trim()).map((k) => [k, d[k].trim() || null]));
    if (Object.keys(changed).length === 0) return onClose();
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/clients/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save");
      onSaved(data.client);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const input = (k: Key, label: string, opts: { type?: string; size?: "short" | "medium" | "full"; placeholder?: string; auto?: string } = {}) => (
    <FieldGroup label={label} htmlFor={`contact-${k}`} size={opts.size}>
      <input id={`contact-${k}`} type={opts.type ?? "text"} value={d[k]} onChange={set(k)} placeholder={opts.placeholder} autoComplete={opts.auto ?? "off"} className={INPUT} />
    </FieldGroup>
  );

  return (
    <SideDrawer open={open} onClose={onClose} title="Edit contact" subtitle="Projects and the client portal use these details.">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Name</legend>
          <FieldRow>
            {input("first_name", "First name")}
            {input("last_name", "Last name")}
          </FieldRow>
          {input("company_name", "Company (optional)")}
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">How to reach them</legend>
          <FieldRow>
            {input("email", "Email", { type: "email" })}
            {input("phone", "Phone", { type: "tel" })}
          </FieldRow>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Partner (weddings)</legend>
          <FieldRow>
            {input("partner_first_name", "Partner first name")}
            {input("partner_last_name", "Partner last name")}
          </FieldRow>
          <FieldRow>
            {input("partner_phone", "Partner phone", { type: "tel" })}
            {input("married_last_name", "Married last name")}
          </FieldRow>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">Address</legend>
          {input("address_line1", "Street")}
          {input("address_line2", "Apt, suite (optional)")}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem]">
            {input("city", "City")}
            {input("state", "State")}
            {input("postal_code", "ZIP")}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">More</legend>
          <FieldRow>
            {input("referral_source", "Where they heard of you")}
            <FieldGroup label="Status" htmlFor="contact-status">
              <select id="contact-status" value={d.status} onChange={set("status")} className={INPUT}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </FieldGroup>
          </FieldRow>
          {/^added by /i.test(initial.referral_source) && (
            <p className="text-xs text-muted">&ldquo;{initial.referral_source}&rdquo; marks a DJ&apos;s own client: their emails to this contact skip the office copy. Changing it changes that.</p>
          )}
        </fieldset>
        {err && (
          <p role="alert" className="text-sm text-status-declined">
            {err}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </SideDrawer>
  );
}
