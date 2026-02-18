import { useState, useEffect } from 'react';
import { Filter, Bookmark, X, ChevronDown, Save, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export interface IncidentFilters {
  status: string;
  severity: string;
  riskLevel: string;
  classification: string;
  eventType: string;
  dateRange: string;
  assignedTo: string;
}

export interface SavedView {
  id: string;
  name: string;
  filters: IncidentFilters;
  isDefault?: boolean;
}

const DEFAULT_FILTERS: IncidentFilters = {
  status: 'all',
  severity: 'all',
  riskLevel: 'all',
  classification: 'all',
  eventType: 'all',
  dateRange: 'all',
  assignedTo: 'all',
};

const STORAGE_KEY = 'socmind_saved_views';

interface SmartFiltersProps {
  filters: IncidentFilters;
  onChange: (filters: IncidentFilters) => void;
  activeCount: number;
}

export function SmartFilters({ filters, onChange, activeCount }: SmartFiltersProps) {
  const [open, setOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setSavedViews(JSON.parse(stored)); } catch {}
    } else {
      // seed default views
      const defaults: SavedView[] = [
        { id: 'critical', name: '🔴 Critical Only', filters: { ...DEFAULT_FILTERS, riskLevel: 'Critical' } },
        { id: 'open', name: '📂 Open & Escalated', filters: { ...DEFAULT_FILTERS, status: 'open' } },
        { id: 'tp', name: '✅ True Positives', filters: { ...DEFAULT_FILTERS, classification: 'True Positive' } },
      ];
      setSavedViews(defaults);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    }
  }, []);

  const activeFiltersCount = Object.entries(filters).filter(
    ([, v]) => v !== 'all' && v !== ''
  ).length;

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const view: SavedView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      filters: { ...filters },
    };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNewViewName('');
    setSavingView(false);
    toast.success(`View "${view.name}" saved`);
  };

  const handleDeleteView = (id: string) => {
    const updated = savedViews.filter(v => v.id !== id);
    setSavedViews(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleLoadView = (view: SavedView) => {
    onChange(view.filters);
    setOpen(false);
    toast.success(`Loaded view: ${view.name}`);
  };

  const handleReset = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Active filter chips */}
      {filters.riskLevel !== 'all' && (
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/30 text-xs h-7">
          Risk: {filters.riskLevel}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onChange({ ...filters, riskLevel: 'all' })} />
        </Badge>
      )}
      {filters.severity !== 'all' && (
        <Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/30 text-xs h-7">
          Severity: {filters.severity}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onChange({ ...filters, severity: 'all' })} />
        </Badge>
      )}
      {filters.eventType !== 'all' && (
        <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30 text-xs h-7">
          Type: {filters.eventType}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onChange({ ...filters, eventType: 'all' })} />
        </Badge>
      )}
      {filters.classification !== 'all' && (
        <Badge variant="outline" className="gap-1 bg-secondary text-secondary-foreground text-xs h-7">
          {filters.classification}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onChange({ ...filters, classification: 'all' })} />
        </Badge>
      )}
      {filters.dateRange !== 'all' && (
        <Badge variant="outline" className="gap-1 bg-secondary text-secondary-foreground text-xs h-7">
          {filters.dateRange}
          <X className="h-3 w-3 cursor-pointer" onClick={() => onChange({ ...filters, dateRange: 'all' })} />
        </Badge>
      )}

      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-muted-foreground hover:text-destructive px-2">
          <X className="h-3 w-3 mr-1" /> Clear all
        </Button>
      )}

      {/* Filter Panel */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 relative">
            <Filter className="h-3.5 w-3.5" />
            Smart Filters
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 bg-card border-border" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Smart Filters</h4>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 text-xs text-muted-foreground">Reset</Button>
              )}
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Severity</label>
                <Select value={filters.severity} onValueChange={(v) => onChange({ ...filters, severity: v })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical (9-10)</SelectItem>
                    <SelectItem value="high">High (7-8)</SelectItem>
                    <SelectItem value="medium">Medium (4-6)</SelectItem>
                    <SelectItem value="low">Low (1-3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Risk Level</label>
                <Select value={filters.riskLevel} onValueChange={(v) => onChange({ ...filters, riskLevel: v })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Risks</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Classification</label>
                <Select value={filters.classification} onValueChange={(v) => onChange({ ...filters, classification: v })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="True Positive">True Positive</SelectItem>
                    <SelectItem value="False Positive">False Positive</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Event Type</label>
                <Select value={filters.eventType} onValueChange={(v) => onChange({ ...filters, eventType: v })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="Malware">Malware</SelectItem>
                    <SelectItem value="Authentication">Authentication</SelectItem>
                    <SelectItem value="Brute Force">Brute Force</SelectItem>
                    <SelectItem value="Ransomware">Ransomware</SelectItem>
                    <SelectItem value="Phishing">Phishing</SelectItem>
                    <SelectItem value="Data Exfiltration">Data Exfiltration</SelectItem>
                    <SelectItem value="Lateral Movement">Lateral Movement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(v) => onChange({ ...filters, dateRange: v })}>
                  <SelectTrigger className="h-8 text-xs bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Saved Views */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Bookmark className="h-3 w-3" /> Saved Views
                </h5>
                <Button variant="ghost" size="sm" onClick={() => setSavingView(!savingView)} className="h-6 text-xs gap-1">
                  <Save className="h-3 w-3" /> Save current
                </Button>
              </div>

              {savingView && (
                <div className="flex gap-1">
                  <Input
                    placeholder="View name..."
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    className="h-7 text-xs bg-secondary/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                  />
                  <Button size="sm" onClick={handleSaveView} className="h-7 text-xs px-2">Save</Button>
                </div>
              )}

              <div className="space-y-1 max-h-36 overflow-y-auto">
                {savedViews.map(view => (
                  <div key={view.id} className="flex items-center justify-between group rounded-md px-2 py-1.5 hover:bg-secondary/60 cursor-pointer transition-colors">
                    <span className="text-xs text-foreground flex-1" onClick={() => handleLoadView(view)}>{view.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
