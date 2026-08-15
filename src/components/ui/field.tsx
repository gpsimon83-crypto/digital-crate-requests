interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

/**
 * Shared label+input wrapper for simple controlled text fields in admin
 * forms. Based on the most complete of the four near-identical local
 * copies (had both the `type` prop and the `placeholder:text-muted/60`
 * class) — with the control radius updated to rounded-[10px] to match
 * the Button component's radius from the site-wide redesign.
 */
export function Field({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}
