import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ClassificationChartProps {
  truePositives?: number;
  falsePositives?: number;
}

export function ClassificationChart({ truePositives = 0, falsePositives = 0 }: ClassificationChartProps) {
  const total = truePositives + falsePositives;
  const tpPercent = total > 0 ? Math.round((truePositives / total) * 100) : 0;
  const fpPercent = total > 0 ? Math.round((falsePositives / total) * 100) : 0;

  const data = [
    { name: 'True Positive', value: truePositives || 0, color: 'hsl(0, 84%, 60%)' },
    { name: 'False Positive', value: falsePositives || 0, color: 'hsl(142, 76%, 45%)' },
  ];

  const hasData = total > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Classification Distribution</h3>
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222, 47%, 8%)', 
                  border: '1px solid hsl(222, 30%, 18%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 96%)'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No classification data yet
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-destructive">{tpPercent}%</p>
          <p className="text-xs text-muted-foreground">True Positive ({truePositives})</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-success">{fpPercent}%</p>
          <p className="text-xs text-muted-foreground">False Positive ({falsePositives})</p>
        </div>
      </div>
    </div>
  );
}
