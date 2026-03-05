import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

export interface BurndownPoint {
  date: string;
  dayLabel: string;
  planned: number;
  actual: number;
}

interface BurndownChartProps {
  data: BurndownPoint[];
  className?: string;
}

const PLANNED_STROKE = 'hsl(var(--foreground) / 0.9)';
const ACTUAL_STROKE = '#fa7313';

export function BurndownChart({ data, className = '' }: BurndownChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex h-[280px] items-center justify-center text-sm text-muted-foreground ${className}`}>
        No data for this month yet.
      </div>
    );
  }

  const maxY = Math.max(
    ...data.map((d) => Math.max(d.planned, d.actual)),
    1
  );

  return (
    <div className={`h-[280px] w-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="dayLabel"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[0, maxY]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => [value, name === 'actual' ? 'Actual' : 'Planned']}
            labelFormatter={(label) => `Day ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => (
              <span className="text-muted-foreground">{value}</span>
            )}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
          <Line
            type="monotone"
            dataKey="planned"
            name="Planned"
            stroke={PLANNED_STROKE}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke={ACTUAL_STROKE}
            strokeWidth={2}
            dot={{ fill: ACTUAL_STROKE, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 4, fill: ACTUAL_STROKE, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
