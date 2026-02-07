import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Shield, 
  TrendingDown, 
  TrendingUp,
  Edit,
  Trash2,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { RiskRegister, RiskStats } from '@/hooks/useGRCData';

interface RiskRegisterTabProps {
  risks: RiskRegister[];
  riskStats: RiskStats;
  riskByCategory: { category: string; count: number }[];
  onAddRisk: (risk: Omit<RiskRegister, 'id' | 'created_at' | 'updated_at' | 'inherent_risk_score' | 'residual_risk_score'>) => Promise<boolean>;
  onUpdateRisk: (riskId: string, updates: Partial<RiskRegister>) => Promise<boolean>;
  onDeleteRisk: (riskId: string) => Promise<boolean>;
  loading: boolean;
}

const LIKELIHOOD_VALUES = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'] as const;
const IMPACT_VALUES = ['negligible', 'minor', 'moderate', 'major', 'catastrophic'] as const;
const TREATMENT_OPTIONS = ['accept', 'mitigate', 'transfer', 'avoid'] as const;
const MITIGATION_STATUS = ['open', 'in_progress', 'mitigated', 'closed'] as const;

const getRiskScoreColor = (score: number) => {
  if (score >= 20) return 'bg-red-500 text-white';
  if (score >= 12) return 'bg-orange-500 text-white';
  if (score >= 6) return 'bg-yellow-500 text-black';
  return 'bg-green-500 text-white';
};

const getRiskScoreLabel = (score: number) => {
  if (score >= 20) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 6) return 'Medium';
  return 'Low';
};

export function RiskRegisterTab({
  risks,
  riskStats,
  riskByCategory,
  onAddRisk,
  onUpdateRisk,
  onDeleteRisk,
  loading,
}: RiskRegisterTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskRegister | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    risk_id: '',
    risk_title: '',
    risk_description: '',
    risk_category: '',
    likelihood: 'possible' as typeof LIKELIHOOD_VALUES[number],
    impact: 'moderate' as typeof IMPACT_VALUES[number],
    mitigation_strategy: '',
    mitigation_status: 'open',
    treatment_option: 'mitigate',
  });

  const resetForm = () => {
    setFormData({
      risk_id: '',
      risk_title: '',
      risk_description: '',
      risk_category: '',
      likelihood: 'possible',
      impact: 'moderate',
      mitigation_strategy: '',
      mitigation_status: 'open',
      treatment_option: 'mitigate',
    });
  };

  const handleSubmit = async () => {
    if (!formData.risk_id || !formData.risk_title) {
      toast.error('Risk ID and Title are required');
      return;
    }

    if (editingRisk) {
      const success = await onUpdateRisk(editingRisk.id, formData);
      if (success) {
        toast.success('Risk updated successfully');
        setEditingRisk(null);
        resetForm();
      } else {
        toast.error('Failed to update risk');
      }
    } else {
      const success = await onAddRisk({
        ...formData,
        control_id: null,
        residual_likelihood: null,
        residual_impact: null,
        risk_owner: null,
        created_by: null,
      });
      if (success) {
        toast.success('Risk added successfully');
        setIsAddDialogOpen(false);
        resetForm();
      } else {
        toast.error('Failed to add risk');
      }
    }
  };

  const handleEdit = (risk: RiskRegister) => {
    setEditingRisk(risk);
    setFormData({
      risk_id: risk.risk_id,
      risk_title: risk.risk_title,
      risk_description: risk.risk_description || '',
      risk_category: risk.risk_category || '',
      likelihood: risk.likelihood,
      impact: risk.impact,
      mitigation_strategy: risk.mitigation_strategy || '',
      mitigation_status: risk.mitigation_status,
      treatment_option: risk.treatment_option,
    });
  };

  const handleDelete = async (riskId: string) => {
    if (confirm('Are you sure you want to delete this risk?')) {
      const success = await onDeleteRisk(riskId);
      if (success) {
        toast.success('Risk deleted');
      } else {
        toast.error('Failed to delete risk');
      }
    }
  };

  const filteredRisks = risks.filter(risk => {
    if (searchTerm && !risk.risk_title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !risk.risk_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterStatus !== 'all' && risk.mitigation_status !== filterStatus) return false;
    if (filterSeverity !== 'all') {
      const score = risk.inherent_risk_score;
      if (filterSeverity === 'critical' && score < 20) return false;
      if (filterSeverity === 'high' && (score < 12 || score >= 20)) return false;
      if (filterSeverity === 'medium' && (score < 6 || score >= 12)) return false;
      if (filterSeverity === 'low' && score >= 6) return false;
    }
    return true;
  });

  const RiskFormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="risk_id">Risk ID *</Label>
          <Input
            id="risk_id"
            placeholder="RISK-001"
            value={formData.risk_id}
            onChange={(e) => setFormData({ ...formData, risk_id: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="risk_category">Category</Label>
          <Input
            id="risk_category"
            placeholder="Operational, Technical..."
            value={formData.risk_category}
            onChange={(e) => setFormData({ ...formData, risk_category: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="risk_title">Risk Title *</Label>
        <Input
          id="risk_title"
          placeholder="Describe the risk..."
          value={formData.risk_title}
          onChange={(e) => setFormData({ ...formData, risk_title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="risk_description">Description</Label>
        <Textarea
          id="risk_description"
          placeholder="Detailed risk description..."
          value={formData.risk_description}
          onChange={(e) => setFormData({ ...formData, risk_description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Likelihood</Label>
          <Select value={formData.likelihood} onValueChange={(v) => setFormData({ ...formData, likelihood: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIKELIHOOD_VALUES.map(l => (
                <SelectItem key={l} value={l}>{l.replace('_', ' ').toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Impact</Label>
          <Select value={formData.impact} onValueChange={(v) => setFormData({ ...formData, impact: v as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPACT_VALUES.map(i => (
                <SelectItem key={i} value={i}>{i.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Treatment</Label>
          <Select value={formData.treatment_option} onValueChange={(v) => setFormData({ ...formData, treatment_option: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TREATMENT_OPTIONS.map(t => (
                <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.mitigation_status} onValueChange={(v) => setFormData({ ...formData, mitigation_status: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MITIGATION_STATUS.map(s => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mitigation_strategy">Mitigation Strategy</Label>
        <Textarea
          id="mitigation_strategy"
          placeholder="Describe how this risk will be mitigated..."
          value={formData.mitigation_strategy}
          onChange={(e) => setFormData({ ...formData, mitigation_strategy: e.target.value })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <div>
                <p className="text-2xl font-bold">{riskStats.totalRisks}</p>
                <p className="text-xs text-muted-foreground">Total Risks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{riskStats.openRisks}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{riskStats.mitigatedRisks}</p>
                <p className="text-xs text-muted-foreground">Mitigated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{riskStats.criticalRisks}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-6 w-6 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{riskStats.highRisks}</p>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{riskStats.avgRiskScore}</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search risks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {MITIGATION_STATUS.map(s => (
                  <SelectItem key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical (20-25)</SelectItem>
                <SelectItem value="high">High (12-19)</SelectItem>
                <SelectItem value="medium">Medium (6-11)</SelectItem>
                <SelectItem value="low">Low (1-5)</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Risk
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Risk</DialogTitle>
                  <DialogDescription>Create a new risk entry in the register</DialogDescription>
                </DialogHeader>
                <RiskFormFields />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmit}>Add Risk</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Risk Table */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Register ({filteredRisks.length})</CardTitle>
          <CardDescription>Track and manage organizational risks with likelihood/impact scoring</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading risks...</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="w-[100px]">Risk ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Category</TableHead>
                    <TableHead className="w-[100px]">Likelihood</TableHead>
                    <TableHead className="w-[100px]">Impact</TableHead>
                    <TableHead className="w-[80px]">Score</TableHead>
                    <TableHead className="w-[100px]">Treatment</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRisks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No risks found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRisks.map((risk) => (
                      <TableRow key={risk.id} className="hover:bg-secondary/30">
                        <TableCell className="font-mono text-sm">{risk.risk_id}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{risk.risk_title}</div>
                          {risk.risk_description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {risk.risk_description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{risk.risk_category || '-'}</TableCell>
                        <TableCell className="text-xs capitalize">{risk.likelihood.replace('_', ' ')}</TableCell>
                        <TableCell className="text-xs capitalize">{risk.impact}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getRiskScoreColor(risk.inherent_risk_score))}>
                            {risk.inherent_risk_score} - {getRiskScoreLabel(risk.inherent_risk_score)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{risk.treatment_option}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            risk.mitigation_status === 'closed' && "bg-green-500/10 text-green-500",
                            risk.mitigation_status === 'mitigated' && "bg-blue-500/10 text-blue-500",
                            risk.mitigation_status === 'in_progress' && "bg-yellow-500/10 text-yellow-500",
                            risk.mitigation_status === 'open' && "bg-red-500/10 text-red-500",
                          )}>
                            {risk.mitigation_status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEdit(risk)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDelete(risk.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRisk} onOpenChange={(open) => !open && setEditingRisk(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Risk</DialogTitle>
            <DialogDescription>Update risk details</DialogDescription>
          </DialogHeader>
          <RiskFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRisk(null)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
