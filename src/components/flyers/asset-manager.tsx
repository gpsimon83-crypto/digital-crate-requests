"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CopyPlus, Folder, FolderInput, FolderOpen, Image as ImageIcon, Loader2, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LibAsset = { id: string; kind: string; name: string | null; folder: string | null; width: number; height: number; has_alpha: boolean; bytes: number | null; created_at: string; approved?: boolean; is_primary?: boolean };
type Usage = { designs: number; templates: string[]; publishedVersions: number };

const KIND_LABEL: Record<string, string> = { background: "Background", overlay: "Overlay", logo: "Logo", image: "Image", photo: "Photo of me", cutout: "Cutout (flyer photo)", name_logo: "DJ name logo" };
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1";
const btn = cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-black/12 bg-white px-3 text-xs font-medium hover:border-gold disabled:pointer-events-none disabled:opacity-40", FOCUS);
const field = cn("w-full rounded-[8px] border border-black/12 bg-white px-2.5 py-1.5 text-sm", FOCUS);
const ALL = "__all";
const UNFILED = "__none";

const sizeLabel = (b: number | null) => (b == null ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

/**
 * Organise images: folders, rename, type, search, select several, move and
 * delete. Staff manage template art (scope "template"); a DJ manages their own
 * uploads (scope "dj"). Deleting something in use asks first and says where.
 */
export function AssetManager({ scope, djId, staff = false, otherDjs = [] }: { scope: "template" | "dj"; djId?: string | null; staff?: boolean; otherDjs?: { id: string; display_name: string }[] }) {
  const [reuseOpen, setReuseOpen] = useState(false);
  const [assets, setAssets] = useState<LibAsset[] | null>(null);
  const [foldersReady, setFoldersReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>(ALL);
  const [kind, setKind] = useState<string>("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<LibAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [uploadKind, setUploadKind] = useState(scope === "template" ? "background" : "photo");
  const fileRef = useRef<HTMLInputElement>(null);
  const kinds = scope === "template" ? ["background", "overlay", "logo", "image"] : ["photo", "cutout", "name_logo", "image"];

  async function load() {
    const url = `/api/flyers/assets?scope=${scope}${djId ? `&dj=${djId}` : ""}`;
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Couldn't load the library.");
    setAssets(j.assets);
    setFoldersReady(j.foldersReady !== false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, djId]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets ?? []) if (a.folder) m.set(a.folder, (m.get(a.folder) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assets]);
  const unfiled = (assets ?? []).filter((a) => !a.folder).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (assets ?? []).filter(
      (a) =>
        (folder === ALL || (folder === UNFILED ? !a.folder : a.folder === folder)) &&
        (!kind || a.kind === kind) &&
        (!needle || (a.name ?? "").toLowerCase().includes(needle) || (a.folder ?? "").toLowerCase().includes(needle))
    );
  }, [assets, folder, kind, q]);

  async function patch(ids: string[], body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const updated: LibAsset[] = [];
    for (const id of ids) {
      const r = await fetch(`/api/flyers/assets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error ?? "Couldn't save.");
        break;
      }
      updated.push(j.asset);
    }
    setAssets((list) => (list ?? []).map((a) => updated.find((u) => u.id === a.id) ?? a));
    setOpen((o) => (o ? (updated.find((u) => u.id === o.id) ?? o) : o));
    setBusy(false);
    return updated.length === ids.length;
  }

  async function remove(ids: string[]) {
    setBusy(true);
    setError(null);
    const gone: string[] = [];
    for (const id of ids) {
      const a = assets?.find((x) => x.id === id);
      let r = await fetch(`/api/flyers/assets/${id}`, { method: "DELETE" });
      let j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.inUse) {
        const u = j.usage as Usage;
        const where = [
          u.designs ? `${u.designs} DJ flyer${u.designs === 1 ? "" : "s"}` : null,
          u.templates.length ? `template${u.templates.length === 1 ? "" : "s"} ${u.templates.map((t) => `“${t}”`).join(", ")}` : null,
          u.publishedVersions && !u.templates.length ? `${u.publishedVersions} published template version${u.publishedVersions === 1 ? "" : "s"}` : null
        ]
          .filter(Boolean)
          .join(" and ");
        if (!window.confirm(`“${a?.name ?? "This image"}” is used in ${where}.\n\nDelete it anyway? Those spots will show an empty frame until a new picture is chosen. This can't be undone.`)) continue;
        r = await fetch(`/api/flyers/assets/${id}?force=1`, { method: "DELETE" });
        j = await r.json().catch(() => ({}));
      }
      if (!r.ok) {
        setError(j.error ?? "Couldn't delete.");
        break;
      }
      gone.push(id);
    }
    setAssets((list) => (list ?? []).filter((a) => !gone.includes(a.id)));
    setSelected((s) => s.filter((x) => !gone.includes(x)));
    if (open && gone.includes(open.id)) setOpen(null);
    if (gone.length) setNotice(`Deleted ${gone.length} image${gone.length === 1 ? "" : "s"}.`);
    setBusy(false);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: LibAsset[] = [];
    for (const f of [...files]) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", uploadKind);
      fd.append("scope", scope);
      if (djId) fd.append("djId", djId);
      if (folder !== ALL && folder !== UNFILED && foldersReady) fd.append("folder", folder);
      const r = await fetch("/api/flyers/assets", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(`${f.name}: ${j.error ?? "upload failed"}`);
        continue;
      }
      added.push(j.asset);
    }
    setAssets((list) => [...added, ...(list ?? [])]);
    if (added.length) setNotice(`Uploaded ${added.length} image${added.length === 1 ? "" : "s"}.`);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const folderBtn = (key: string, label: string, count: number, icon: React.ReactNode) => (
    <button key={key} className={cn("flex min-h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-sm", FOCUS, folder === key ? "bg-gold-soft font-semibold" : "hover:bg-black/[0.04]")} aria-pressed={folder === key} onClick={() => (setFolder(key), setSelected([]))}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-muted">{count}</span>
    </button>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Folders */}
      <nav aria-label="Folders" className="flex flex-col gap-1 lg:sticky lg:top-4 lg:self-start">
        {folderBtn(ALL, "All images", assets?.length ?? 0, <ImageIcon size={15} className="text-muted" />)}
        {folderBtn(UNFILED, "Not in a folder", unfiled, <Folder size={15} className="text-muted" />)}
        {folders.map(([f, n]) => folderBtn(f, f, n, folder === f ? <FolderOpen size={15} className="text-gold-dim" /> : <Folder size={15} className="text-gold-dim" />))}
        {foldersReady ? (
          <button
            className={cn(btn, "mt-2 justify-start")}
            disabled={!selected.length || busy}
            onClick={() => {
              const name = window.prompt(`New folder for the ${selected.length} selected image${selected.length === 1 ? "" : "s"}:`);
              if (name?.trim()) void patch(selected, { folder: name.trim() }).then((ok) => ok && (setFolder(name.trim().slice(0, 60)), setSelected([])));
            }}
            title={selected.length ? undefined : "Select images first"}
          >
            <FolderInput size={14} /> New folder from selected
          </button>
        ) : (
          <p className="mt-2 rounded-[8px] bg-status-pending/10 p-2 text-[11px] text-status-pending">Folders turn on after migration 0051_flyer_asset_folders.sql is run in Supabase.</p>
        )}
      </nav>

      <section className="min-w-0">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[180px] flex-1">
            <span className="sr-only">Search images</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className={cn(field, "pl-8")} placeholder="Search by name or folder" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className="sr-only">Type</span>
            <select className={cn(field, "w-auto")} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All types</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <span className="mx-1 h-6 w-px bg-black/10" aria-hidden />
          <label>
            <span className="sr-only">Upload as</span>
            <select className={cn(field, "w-auto")} value={uploadKind} onChange={(e) => setUploadKind(e.target.value)}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  Upload as {KIND_LABEL[k].toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <input ref={fileRef} id={`upl-${scope}`} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files)} />
          <label htmlFor={`upl-${scope}`} className={cn(btn, "cursor-pointer border-gold bg-gold font-semibold text-[#1a140b]", busy && "pointer-events-none opacity-50")}>
            <Upload size={14} /> Upload{folder !== ALL && folder !== UNFILED ? ` to “${folder}”` : ""}
          </label>
          {scope === "dj" && staff && djId && (
            <button className={btn} data-tour="flyer-reuse" onClick={() => setReuseOpen(true)} disabled={busy}>
              <CopyPlus size={14} /> Add from existing images
            </button>
          )}
        </div>
        {reuseOpen && djId && (
          <ReusePicker
            djId={djId}
            otherDjs={otherDjs.filter((d) => d.id !== djId)}
            folder={folder !== ALL && folder !== UNFILED && foldersReady ? folder : null}
            onClose={() => setReuseOpen(false)}
            onAdded={(list) => {
              setAssets((cur) => [...list, ...(cur ?? [])]);
              setNotice(`Added ${list.length} image${list.length === 1 ? "" : "s"} to this DJ's library.`);
              setReuseOpen(false);
            }}
          />
        )}

        {/* Selection bar */}
        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-gold/40 bg-gold-soft/50 px-3 py-2" role="region" aria-label="Selected images">
            <span className="text-sm font-semibold">{selected.length} selected</span>
            {foldersReady && (
              <>
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Move to folder</span>
                  <input className={cn(field, "w-44 py-1")} list={`folders-${scope}`} placeholder="Move to folder…" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
                </label>
                <button className={btn} disabled={busy || !moveTo.trim()} onClick={() => void patch(selected, { folder: moveTo.trim() }).then((ok) => ok && (setNotice(`Moved to “${moveTo.trim()}”.`), setMoveTo(""), setSelected([])))}>
                  <FolderInput size={14} /> Move
                </button>
                <button className={btn} disabled={busy} onClick={() => void patch(selected, { folder: null }).then((ok) => ok && (setNotice("Taken out of the folder."), setSelected([])))}>
                  Remove from folder
                </button>
              </>
            )}
            <label>
              <span className="sr-only">Change type</span>
              <select className={cn(field, "w-auto py-1")} value="" disabled={busy} onChange={(e) => e.target.value && void patch(selected, { kind: e.target.value }).then((ok) => ok && setNotice("Type changed."))}>
                <option value="">Change type…</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <button className={cn(btn, "border-status-declined/40 text-status-declined")} disabled={busy} onClick={() => window.confirm(`Delete ${selected.length} image${selected.length === 1 ? "" : "s"}? You'll be asked again about any that are in use.`) && void remove(selected)}>
              <Trash2 size={14} /> Delete
            </button>
            <button className={cn(btn, "ml-auto")} onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        )}
        <datalist id={`folders-${scope}`}>
          {folders.map(([f]) => (
            <option key={f} value={f} />
          ))}
        </datalist>

        {error && (
          <p role="alert" className="mb-3 rounded-[8px] border border-status-declined/30 bg-status-declined/10 p-2.5 text-sm text-status-declined">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-3 text-sm text-status-approved">
            {notice}
          </p>
        )}
        {!assets && !error && <p className="text-sm text-muted">Loading…</p>}
        {assets && !shown.length && <p className="rounded-[12px] border border-dashed border-black/15 p-8 text-center text-sm text-muted">{assets.length ? "Nothing matches." : "No images yet. Upload some to get started."}</p>}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {shown.map((a) => {
            const sel = selected.includes(a.id);
            return (
              <li key={a.id} className={cn("group relative overflow-hidden rounded-[12px] border bg-card", sel ? "border-gold ring-2 ring-gold/40" : "border-black/10")}>
                <button className={cn("block w-full text-left", FOCUS)} onClick={() => setOpen(a)} aria-label={`Details for ${a.name ?? "image"}`}>
                  <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/flyers/assets/${a.id}`} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium">{a.name ?? "Untitled"}</p>
                    <p className="truncate text-[11px] text-muted">
                      {KIND_LABEL[a.kind] ?? a.kind}
                      {a.folder && folder === ALL ? ` · ${a.folder}` : ""}
                    </p>
                    {(a.kind === "cutout" || a.kind === "name_logo") && (
                      <p className={cn("mt-0.5 text-[10px] font-semibold uppercase", a.approved === false ? "text-status-pending" : "text-status-approved")}>
                        {a.approved === false ? "Waiting for approval" : a.is_primary ? "Approved · preferred" : "Approved"}
                      </p>
                    )}
                  </div>
                </button>
                <label className={cn("absolute left-2 top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full border bg-white/95 shadow-sm", sel ? "border-gold" : "border-black/15 opacity-80 group-hover:opacity-100")}>
                  <input type="checkbox" className="sr-only" checked={sel} onChange={() => toggle(a.id)} aria-label={`Select ${a.name ?? "image"}`} />
                  {sel ? <Check size={14} className="text-gold-dim" /> : <span className="h-3 w-3 rounded-full border border-black/25" />}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Details drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label="Image details" onClick={() => setOpen(null)}>
          <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[var(--card)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
              <p className="truncate font-semibold">{open.name ?? "Untitled"}</p>
              <button autoFocus className={cn(btn, "h-9 w-9 border-0 px-0")} aria-label="Close" onClick={() => setOpen(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="flex aspect-[4/3] items-center justify-center bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/flyers/assets/${open.id}`} alt={open.name ?? "Image"} className="max-h-full max-w-full object-contain" />
            </div>
            <DetailForm key={open.id} a={open} kinds={kinds} staff={staff} onFlag={(body) => patch([open.id], body).then((ok) => { if (ok) { setNotice("Saved."); if (body.isPrimary) void load(); } })} foldersReady={foldersReady} folderList={folders.map(([f]) => f)} scope={scope} busy={busy} onSave={(body) => patch([open.id], body).then((ok) => ok && setNotice("Saved."))} onDelete={() => window.confirm(`Delete “${open.name ?? "this image"}”?`) && void remove([open.id])} />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailForm({ a, kinds, staff, onFlag, foldersReady, folderList, scope, busy, onSave, onDelete }: { a: LibAsset; kinds: string[]; staff: boolean; onFlag: (b: Record<string, unknown>) => void; foldersReady: boolean; folderList: string[]; scope: string; busy: boolean; onSave: (b: Record<string, unknown>) => void; onDelete: () => void }) {
  const [name, setName] = useState(a.name ?? "");
  const [folder, setFolder] = useState(a.folder ?? "");
  const [kind, setKind] = useState(a.kind);
  const changed = name !== (a.name ?? "") || folder !== (a.folder ?? "") || kind !== a.kind;
  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const body: Record<string, unknown> = {};
        if (name !== (a.name ?? "")) body.name = name;
        if (folder !== (a.folder ?? "")) body.folder = folder.trim() || null;
        if (kind !== a.kind) body.kind = kind;
        onSave(body);
      }}
    >
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
          <Pencil size={11} className="mr-1 inline" />
          Name
        </span>
        <input className={field} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      {foldersReady && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Folder</span>
          <input className={field} list={`folders-detail-${scope}`} value={folder} maxLength={60} placeholder="Not in a folder" onChange={(e) => setFolder(e.target.value)} />
          <datalist id={`folders-detail-${scope}`}>
            {folderList.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">Type</span>
        <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      {(a.kind === "cutout" || a.kind === "name_logo") && (
        <div className="rounded-[10px] bg-black/[0.04] p-3 text-xs">
          <p className="font-semibold">{a.approved === false ? "Waiting for staff approval" : a.is_primary ? "Approved · used on flyers first" : "Approved"}</p>
          <p className="mt-1 text-muted">{a.kind === "cutout" ? "Approved cutouts fill DJ photo slots on flyers (instead of the profile photo)." : "Approved name logos fill DJ name logo slots. Without one, the DJ's name is shown as text."}</p>
          {staff ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className={btn} disabled={busy} onClick={() => onFlag({ approved: a.approved === false })}>
                {a.approved === false ? "Approve" : "Withdraw approval"}
              </button>
              {!a.is_primary && (
                <button type="button" className={btn} disabled={busy} onClick={() => onFlag({ isPrimary: true })}>
                  Make preferred
                </button>
              )}
            </div>
          ) : (
            a.approved === false && <p className="mt-1 text-muted">Staff will review it before it appears on flyers.</p>
          )}
        </div>
      )}
      <p className="text-xs text-muted">
        {a.width} × {a.height} px {sizeLabel(a.bytes) && `· ${sizeLabel(a.bytes)}`} {a.has_alpha && "· transparent"} · added {new Date(a.created_at).toLocaleDateString()}
      </p>
      <div className="flex gap-2">
        <button type="submit" className={cn(btn, "flex-1 border-gold bg-gold font-semibold text-[#1a140b]")} disabled={!changed || busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
        <button type="button" className={cn(btn, "border-status-declined/40 text-status-declined")} disabled={busy} onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </form>
  );
}

/**
 * Staff: pick images already uploaded (template art, or another DJ's
 * library) and add copies to this DJ's library, choosing what they are.
 */
function ReusePicker({ djId, otherDjs, folder, onClose, onAdded }: { djId: string; otherDjs: { id: string; display_name: string }[]; folder: string | null; onClose: () => void; onAdded: (a: LibAsset[]) => void }) {
  const [source, setSource] = useState("template");
  const [items, setItems] = useState<LibAsset[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [kind, setKind] = useState("cutout");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    setPicked([]);
    fetch(source === "template" ? "/api/flyers/assets?scope=template" : `/api/flyers/assets?scope=dj&dj=${source}`)
      .then((r) => r.json())
      .then((j) => live && setItems(j.assets ?? []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [source]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const shown = (items ?? []).filter((a) => {
    const n = q.trim().toLowerCase();
    return !n || (a.name ?? "").toLowerCase().includes(n) || (a.folder ?? "").toLowerCase().includes(n);
  });

  async function add() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/flyers/assets/copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceIds: picked, djId, kind, folder }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Couldn't add those images.");
    onAdded((j.assets ?? []) as LibAsset[]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="reuse-title" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[18px] bg-[var(--card)] shadow-2xl sm:rounded-[18px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div>
            <p id="reuse-title" className="font-semibold">
              Add from existing images
            </p>
            <p className="text-xs text-muted">Pick images that are already uploaded. Copies go into this DJ&apos;s library; the originals stay where they are.</p>
          </div>
          <button autoFocus className={cn(btn, "h-9 w-9 shrink-0 border-0 px-0")} aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-5 py-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">From</span>
            <select className={cn(field, "w-auto")} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Take images from">
              <option value="template">Template art library</option>
              {otherDjs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}&apos;s library
                </option>
              ))}
            </select>
          </label>
          <label className="relative min-w-[160px] flex-1">
            <span className="sr-only">Search</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className={cn(field, "pl-8")} placeholder="Search by name or folder" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!items && <p className="text-sm text-muted">Loading…</p>}
          {items && !shown.length && <p className="text-sm text-muted">{items.length ? "Nothing matches." : "No images there yet."}</p>}
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {shown.map((a) => {
              const on = picked.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    className={cn("block w-full overflow-hidden rounded-[10px] border-2 text-left", FOCUS, on ? "border-gold" : "border-transparent hover:border-black/15")}
                    aria-pressed={on}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                  >
                    <span className="relative flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/flyers/assets/${a.id}`} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-gold text-[#1a140b]">
                          <Check size={13} />
                        </span>
                      )}
                    </span>
                    <span className="block truncate px-1.5 py-1 text-[11px]">{a.name ?? "Untitled"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-black/10 px-5 py-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Add as</span>
            <select className={cn(field, "w-auto")} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Add as">
              {["cutout", "name_logo", "photo", "image"].map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          {folder && <span className="text-xs text-muted">into “{folder}”</span>}
          {err && (
            <span role="alert" className="text-xs text-status-declined">
              {err}
            </span>
          )}
          <span className="flex-1" />
          <button className={btn} onClick={onClose}>
            Cancel
          </button>
          <button className={cn(btn, "border-gold bg-gold font-semibold text-[#1a140b]")} disabled={!picked.length || busy} onClick={() => void add()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CopyPlus size={14} />} Add {picked.length || ""} to library
          </button>
        </div>
      </div>
    </div>
  );
}
