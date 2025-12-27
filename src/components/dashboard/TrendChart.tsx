import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendChartProps {
  data?: { date: string; incidents: number; truePositive: number }[];
}

export function TrendChart({ data = [] }: TrendChartProps) {
  const hasData = data.length > 0 && data.some(d => d.incidents > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Incidents Trend (7 Days)</h3>
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(187, 100%, 50%)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTrue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222, 47%, 8%)', 
                  border: '1px solid hsl(222, 30%, 18%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 96%)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="incidents" 
                name="Total Incidents"
                stroke="hsl(187, 100%, 50%)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorIncidents)" 
              />
              <Area 
                type="monotone" 
                dataKey="truePositive" 
                name="True Positives"
                stroke="hsl(0, 84%, 60%)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorTrue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No incident data for the last 7 days
          </div>
        )}
      </div>
    </div>
  );
}
