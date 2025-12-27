import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Incident {
  mitre_technique?: string | null;
  mitre_tactic?: string | null;
}

interface MitreChartProps {
  incidents?: Incident[];
}

export function MitreChart({ incidents = [] }: MitreChartProps) {
  // Group incidents by MITRE technique
  const techniqueCounts = incidents.reduce((acc, incident) => {
    if (incident.mitre_technique) {
      const technique = incident.mitre_technique;
      const tactic = incident.mitre_tactic || 'Unknown';
      const key = `${technique} - ${tactic}`;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Convert to array and sort by count
  const data = Object.entries(techniqueCounts)
    .map(([technique, count]) => ({ technique, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Top MITRE ATT&CK Techniques</h3>
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="technique" 
                stroke="hsl(215, 20%, 55%)" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222, 47%, 8%)', 
                  border: '1px solid hsl(222, 30%, 18%)',
                  borderRadius: '8px',
                  color: 'hsl(210, 40%, 96%)'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(187, 100%, 50%)" 
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No MITRE ATT&CK data yet
          </div>
        )}
      </div>
    </div>
  );
}
