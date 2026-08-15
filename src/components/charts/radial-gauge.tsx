"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function RadialGauge({ value, label }: { value: number; label: string }) {
  const data = [{ name: label, value, fill: "#BA8B4B" }];

  return (
    <div className="relative h-[140px] w-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={5} background={{ fill: "#F1EEE6" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-light">{value}%</span>
        <span className="text-[10px] text-muted">{label}</span>
      </div>
    </div>
  );
}
