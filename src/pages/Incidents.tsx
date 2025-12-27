import { useState } from 'react';
import { Filter, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { IncidentTable } from '@/components/dashboard/IncidentTable';
import { mockIncidents } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Incidents() {
  const [filter, setFilter] = useState<string>('all');

  const filteredIncidents = filter === 'all' 
    ? mockIncidents 
    : mockIncidents.filter(i => i.status.toLowerCase().replace(' ', '-') === filter);

  const filters = [
    { key: 'all', label: 'All', count: mockIncidents.length },
    { key: 'open', label: 'Open', count: mockIncidents.filter(i => i.status === 'Open').length },
    { key: 'in-progress', label: 'In Progress', count: mockIncidents.filter(i => i.status === 'In Progress').length },
    { key: 'closed', label: 'Closed', count: mockIncidents.filter(i => i.status === 'Closed').length },
  ];

  return (
    <AppLayout title="Incidents" subtitle="Security incident management">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              className={filter === f.key ? 'bg-primary text-primary-foreground' : ''}
            >
              {f.label}
              <Badge variant="secondary" className="ml-2 bg-secondary/50">
                {f.count}
              </Badge>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Advanced Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <IncidentTable incidents={filteredIncidents} />
    </AppLayout>
  );
}
