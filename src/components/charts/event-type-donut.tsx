"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSlice {
  label: string;
  value: number;
}

const PALETTE = ["#BA8B4B", "#795A31", "#34C759", "#4C86FF", "#D6B993", "#7A7669"];

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-[2px] border border-border bg-card px-3 py-2 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
      <p className="font-semibold capitalize">{name}</p>
      <p className="text-muted">{money(value)}</p>
    </div>
  );
}

export function EventTypeDonut({ data, centerLabel, centerValue }: { data: DonutSlice[]; centerLabel: string; centerValue: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[160px] w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={d.label} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<TooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-light">{centerValue}</span>
          <span className="text-[10px] text-muted">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-[80px] capitalize">{d.label}</span>
            <span className="text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
