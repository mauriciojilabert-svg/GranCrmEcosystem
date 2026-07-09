import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any): JSX.Element | null => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e9ecef',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      fontSize: 12,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#283c50' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ margin: '2px 0', color: p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export interface BarSeries {
  key: string;
  color: string;
  label?: string;
}

export interface BarChartWidgetProps {
  data: any[];
  series: BarSeries[];
  height?: number;
  stacked?: boolean;
  rounded?: number;
  barSize?: number;
  layout?: 'horizontal' | 'vertical';
}

export function BarChartWidget({ 
  data = [], 
  series = [], 
  height = 260, 
  stacked, 
  rounded = 6, 
  barSize,
  layout = 'horizontal'
}: BarChartWidgetProps): JSX.Element {
  const isVert = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout={layout}
        data={data}
        margin={{ top: 10, right: 10, left: isVert ? 0 : -20, bottom: 0 }}
        barGap={3}
        barCategoryGap="25%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={!isVert} horizontal={isVert} />
        {isVert ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#8c8c8c' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#8c8c8c' }} axisLine={false} tickLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8c8c8c' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#8c8c8c' }} axisLine={false} tickLine={false} width={40} />
          </>
        )}
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(70,128,255,0.04)' }} />
        {series.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          />
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label || s.key}
            fill={s.color}
            stackId={stacked ? 'stack' : undefined}
            radius={isVert 
              ? (rounded ? [0, rounded, rounded, 0] : undefined) 
              : (rounded ? [rounded, rounded, 0, 0] : undefined)
            }
            maxBarSize={barSize || (isVert ? 20 : 40)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
