import React from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';

export interface PieData {
  name: string;
  value: number;
  color: string;
}

export interface PieChartWidgetProps {
  data: PieData[];
  donut?: boolean;
  height?: number;
  legend?: boolean;
}

export function PieChartWidget({ data = [], donut = true, height = 260, legend = true }: PieChartWidgetProps): JSX.Element {
  const innerRadius = donut ? '60%' : '0%';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="80%"
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
        />
        {legend && (
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            formatter={(value) => <span style={{ color: '#555', fontWeight: 500 }}>{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
