import { useState, useRef } from 'react';
import { Upload, FileJson, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportResult {
  incident_number: string;
  classification?: string;
  risk_level?: string;
  status: 'success' | 'error';
  error?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_FIELDS = ['event_type', 'severity', 'source_ip', 'message'];
const OPTIONAL_FIELDS = ['destination_ip', 'file_hash', 'user', 'hostname', 'tags', 'event_time'];

export function FileImportDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParsing(false);
    setImporting(false);
    setProgress(0);
    setResults([]);
    setValidationErrors([]);
    setParsedData([]);
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const row: any = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    }

    return data;
  };

  const normalizeFieldName = (field: string): string => {
    const mappings: Record<string, string> = {
      'eventtype': 'event_type',
      'event_type': 'event_type',
      'type': 'event_type',
      'sourceip': 'source_ip',
      'source_ip': 'source_ip',
      'srcip': 'source_ip',
      'src_ip': 'source_ip',
      'destinationip': 'destination_ip',
      'destination_ip': 'destination_ip',
      'dstip': 'destination_ip',
      'dst_ip': 'destination_ip',
      'filehash': 'file_hash',
      'file_hash': 'file_hash',
      'hash': 'file_hash',
      'msg': 'message',
      'message': 'message',
      'description': 'message',
      'eventtime': 'event_time',
      'event_time': 'event_time',
      'timestamp': 'event_time',
      'time': 'event_time',
    };
    return mappings[field.toLowerCase()] || field.toLowerCase();
  };

  const normalizeData = (data: any[]): any[] => {
    return data.map(row => {
      const normalized: any = {};
      Object.keys(row).forEach(key => {
        const normalizedKey = normalizeFieldName(key);
        normalized[normalizedKey] = row[key];
      });
      // Ensure severity is a number
      if (normalized.severity) {
        normalized.severity = parseInt(normalized.severity) || 3;
      }
      return normalized;
    });
  };

  const validateData = (data: any[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    data.forEach((row, idx) => {
      REQUIRED_FIELDS.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push({
            row: idx + 1,
            field,
            message: `Missing required field: ${field}`,
          });
        }
      });

      // Validate severity
      if (row.severity) {
        const sev = parseInt(row.severity);
        if (isNaN(sev) || sev < 1 || sev > 5) {
          errors.push({
            row: idx + 1,
            field: 'severity',
            message: 'Severity must be between 1 and 5',
          });
        }
      }

      // Validate IP format (basic)
      if (row.source_ip && !/^[\d.a-zA-Z:]+$/.test(row.source_ip)) {
        errors.push({
          row: idx + 1,
          field: 'source_ip',
          message: 'Invalid IP address format',
        });
      }
    });

    return errors;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setValidationErrors([]);
    setParsedData([]);

    try {
      const text = await selectedFile.text();
      let data: any[];

      if (selectedFile.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed) ? parsed : parsed.logs || parsed.incidents || [parsed];
      } else if (selectedFile.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        throw new Error('Unsupported file format. Please use JSON or CSV.');
      }

      const normalizedData = normalizeData(data);
      const errors = validateData(normalizedData);

      setValidationErrors(errors);
      setParsedData(normalizedData);

      if (errors.length === 0) {
        toast.success(`Parsed ${normalizedData.length} records successfully`);
      } else {
        toast.warning(`Found ${errors.length} validation issues`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse file');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    setProgress(0);
    setResults([]);

    const importResults: ImportResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < parsedData.length; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (row) => {
          try {
            const response = await supabase.functions.invoke('ingest-log', {
              body: {
                logs: {
                  eventType: row.event_type,
                  severity: row.severity || 3,
                  srcIP: row.source_ip,
                  dstIP: row.destination_ip || 'Unknown',
                  msg: row.message,
                  fileHash: row.file_hash || undefined,
                  time: row.event_time || new Date().toISOString(),
                },
                source: 'File Import',
              },
            });

            if (response.error) throw response.error;

            const incident = response.data?.incidents?.[0];
            return {
              incident_number: incident?.incident_number || 'Created',
              classification: incident?.classification,
              risk_level: incident?.risk_level,
              status: 'success' as const,
            };
          } catch (error) {
            return {
              incident_number: 'Failed',
              status: 'error' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      importResults.push(...batchResults);
      setResults([...importResults]);
      setProgress(Math.round(((i + batch.length) / parsedData.length) * 100));
    }

    setImporting(false);
    
    const successCount = importResults.filter(r => r.status === 'success').length;
    const errorCount = importResults.filter(r => r.status === 'error').length;

    if (errorCount === 0) {
      toast.success(`Imported ${successCount} incidents successfully`);
    } else if (successCount === 0) {
      toast.error(`Failed to import all ${errorCount} incidents`);
    } else {
      toast.warning(`Imported ${successCount} incidents, ${errorCount} failed`);
    }

    if (successCount > 0) {
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Import File
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Incidents from File</DialogTitle>
          <DialogDescription>
            Upload a JSON or CSV file containing security incidents for bulk analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Drop Zone */}
          {!file && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                "hover:border-primary hover:bg-primary/5",
                "border-border bg-secondary/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex justify-center gap-4 mb-4">
                <FileJson className="h-10 w-10 text-blue-500" />
                <FileSpreadsheet className="h-10 w-10 text-green-500" />
              </div>
              <p className="font-medium text-foreground mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-muted-foreground">
                JSON or CSV files up to 10MB
              </p>
            </div>
          )}

          {/* File Selected */}
          {file && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                {file.name.endsWith('.json') ? (
                  <FileJson className="h-8 w-8 text-blue-500" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8 text-green-500" />
                )}
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • {parsedData.length} records
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetState}
                disabled={importing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Parsing State */}
          {parsing && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-muted-foreground">Parsing file...</span>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">
                  {validationErrors.length} Validation Errors
                </span>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {validationErrors.slice(0, 20).map((err, idx) => (
                    <p key={idx} className="text-xs text-destructive/80">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                  {validationErrors.length > 20 && (
                    <p className="text-xs text-destructive/80 font-medium">
                      ...and {validationErrors.length - 20} more errors
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Schema Info */}
          {!file && (
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-sm font-medium text-foreground mb-2">Required Fields:</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {REQUIRED_FIELDS.map(field => (
                  <Badge key={field} variant="default" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
              <p className="text-sm font-medium text-foreground mb-2">Optional Fields:</p>
              <div className="flex flex-wrap gap-1">
                {OPTIONAL_FIELDS.map(field => (
                  <Badge key={field} variant="outline" className="text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importing incidents...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Import Results */}
          {results.length > 0 && !importing && (
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Import Complete</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-500">
                  ✓ {results.filter(r => r.status === 'success').length} succeeded
                </span>
                {results.filter(r => r.status === 'error').length > 0 && (
                  <span className="text-destructive">
                    ✗ {results.filter(r => r.status === 'error').length} failed
                  </span>
                )}
              </div>
              <ScrollArea className="h-32 mt-3">
                <div className="space-y-1">
                  {results.slice(0, 50).map((result, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {result.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                      <span className={result.status === 'error' ? 'text-destructive' : ''}>
                        {result.incident_number}
                        {result.risk_level && ` • ${result.risk_level}`}
                        {result.error && ` - ${result.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setOpen(false); resetState(); }}>
            {results.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          {parsedData.length > 0 && validationErrors.length === 0 && !results.length && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${parsedData.length} Incidents`
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
