"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface RevenuePoint {
  label: string;
  bookedCents: number;
  collectedCents: number;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const booked = payload.find((p) => p.dataKey === "bookedCents")?.value ?? 0;
  const collected = payload.find((p) => p.dataKey === "collectedCents")?.value ?? 0;
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="text-muted">
        Booked: <span className="font-medium text-foreground">{money(booked)}</span>
      </p>
      <p className="text-muted">
        Collected: <span className="font-medium text-foreground">{money(collected)}</span>
      </p>
    </div>
  );
}

export function RevenueAreaChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bookedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#BA8B4B" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#BA8B4B" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34C759" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#34C759" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E1D5" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#7A7669" }} axisLine={{ stroke: "#E6E1D5" }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#7A7669" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Math.round(v / 100000) * 1}K`.replace("$0K", "$0")}
          width={40}
        />
        <Tooltip content={<TooltipContent />} />
        <Area type="monotone" dataKey="bookedCents" stroke="#BA8B4B" strokeWidth={2} fill="url(#bookedFill)" name="Booked" />
        <Area type="monotone" dataKey="collectedCents" stroke="#34C759" strokeWidth={2} fill="url(#collectedFill)" name="Collected" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
