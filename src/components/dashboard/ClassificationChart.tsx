import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const data = [
  { name: 'True Positive', value: 106, color: 'hsl(0, 84%, 60%)' },
  { name: 'False Positive', value: 50, color: 'hsl(142, 76%, 45%)' },
];

export function ClassificationChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Classification Distribution</h3>
      <div className="h-64">
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
      </div>
      <div className="mt-4 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-destructive">68%</p>
          <p className="text-xs text-muted-foreground">True Positive</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-success">32%</p>
          <p className="text-xs text-muted-foreground">False Positive</p>
        </div>
      </div>
    </div>
  );
}
