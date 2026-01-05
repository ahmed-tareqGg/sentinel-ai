import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutonomousSOCRequest {
  incident_id: string;
  mode?: 'autonomous' | 'supervised' | 'simulation';
}

interface PipelineResult {
  step: string;
  status: 'success' | 'failed' | 'skipped';
  details: any;
  timestamp: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: PipelineResult[] = [];

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    const isInternalCall = authHeader === `Bearer ${supabaseKey}`;
    
    if (!isInternalCall) {
      // Verify user authentication for external calls
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || '' } }
      });
      
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        console.log('🚫 Unauthorized access attempt to autonomous-soc');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Check user role - only allow analysts and higher
      const { data: roleData } = await authClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'ciso'];
      if (!roleData || !allowedRoles.includes(roleData.role)) {
        console.log(`🚫 Insufficient permissions for user ${user.id} with role ${roleData?.role}`);
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log(`✅ Authenticated user ${user.id} with role ${roleData.role}`);
    } else {
      console.log('✅ Internal service call authenticated');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { incident_id, mode = 'autonomous' } = await req.json() as AutonomousSOCRequest;

    console.log(`🤖 Autonomous SOC Pipeline started for ${incident_id} in ${mode} mode`);

    // Fetch incident
    const { data: incident, error: incidentError } = await supabase
      .from('incidents')
      .select('*')
      .eq('id', incident_id)
      .single();

    if (incidentError || !incident) {
      throw new Error('Incident not found');
    }

    results.push({
      step: 'fetch_incident',
      status: 'success',
      details: { incident_number: incident.incident_number, event_type: incident.event_type },
      timestamp: new Date().toISOString(),
    });

    // Check if autonomous mode is enabled globally
    const { data: autonomousConfig } = await supabase
      .from('integrations')
      .select('*')
      .eq('name', 'autonomous_soc')
      .single();

    const isAutonomous = mode === 'autonomous' || autonomousConfig?.autonomous_mode_enabled;
    const confidenceThreshold = autonomousConfig?.auto_execution_threshold || 75;

    // Step 1: AI Analysis (if not already done)
    if (!incident.ai_analysis || incident.classification === 'Pending') {
      console.log('📊 Running AI analysis...');
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-log`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          log: {
            eventType: incident.event_type,
            severity: incident.severity,
            srcIP: incident.src_ip,
            dstIP: incident.dst_ip,
            msg: incident.message,
            fileHash: incident.file_hash,
          },
          internal: true,
        }),
      });

      if (analyzeResponse.ok) {
        const analysis = await analyzeResponse.json();
        await supabase.from('incidents').update({
          classification: analysis.classification,
          confidence: analysis.confidence,
          risk_level: analysis.risk_level,
          ai_analysis: analysis.ai_analysis,
          mitre_technique: analysis.mitre_technique,
          mitre_tactic: analysis.mitre_tactic,
          sandbox_result: analysis.sandbox_result,
          recommended_actions: analysis.recommended_actions,
        }).eq('id', incident_id);

        // Update local incident object
        Object.assign(incident, analysis);

        results.push({
          step: 'ai_analysis',
          status: 'success',
          details: { classification: analysis.classification, confidence: analysis.confidence, risk_level: analysis.risk_level },
          timestamp: new Date().toISOString(),
        });
      } else {
        results.push({
          step: 'ai_analysis',
          status: 'failed',
          details: { error: 'Analysis failed' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 2: Generate Report
    console.log('📄 Generating incident report...');
    let reportPdf = null;
    try {
      const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'incident',
          incident_id: incident_id,
        }),
      });

      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        reportPdf = reportData.pdf_base64;
        results.push({
          step: 'generate_report',
          status: 'success',
          details: { report_id: reportData.report_id },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (reportError) {
      console.error('Report generation failed:', reportError);
      results.push({
        step: 'generate_report',
        status: 'failed',
        details: { error: String(reportError) },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 3: Create Jira Ticket
    console.log('🎫 Creating Jira ticket...');
    let jiraTicket = null;
    try {
      const jiraResponse = await fetch(`${supabaseUrl}/functions/v1/create-jira-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incident_id: incident_id,
          pdf_content: reportPdf,
        }),
      });

      if (jiraResponse.ok) {
        jiraTicket = await jiraResponse.json();
        results.push({
          step: 'create_jira_ticket',
          status: 'success',
          details: { jira_key: jiraTicket.jira_key, jira_url: jiraTicket.jira_url },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (jiraError) {
      console.error('Jira ticket creation failed:', jiraError);
      results.push({
        step: 'create_jira_ticket',
        status: 'failed',
        details: { error: String(jiraError) },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 4: Execute Playbook (if autonomous and confidence is high enough)
    const shouldExecutePlaybook = isAutonomous && 
      incident.classification === 'True Positive' &&
      incident.confidence >= confidenceThreshold;

    if (shouldExecutePlaybook) {
      console.log('⚡ Executing playbook autonomously...');
      try {
        const playbookResponse = await fetch(`${supabaseUrl}/functions/v1/smart-playbook`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            incident_id: incident_id,
            event_type: incident.event_type,
            risk_level: incident.risk_level,
            classification: incident.classification,
            confidence: incident.confidence,
            src_ip: incident.src_ip,
          }),
        });

        if (playbookResponse.ok) {
          const playbookResult = await playbookResponse.json();
          results.push({
            step: 'execute_playbook',
            status: 'success',
            details: { 
              playbooks_executed: playbookResult.executed_count,
              decisions: playbookResult.decisions,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (playbookError) {
        console.error('Playbook execution failed:', playbookError);
        results.push({
          step: 'execute_playbook',
          status: 'failed',
          details: { error: String(playbookError) },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      results.push({
        step: 'execute_playbook',
        status: 'skipped',
        details: { 
          reason: !isAutonomous ? 'Not in autonomous mode' :
                  incident.classification !== 'True Positive' ? 'Not a true positive' :
                  `Confidence ${incident.confidence}% below threshold ${confidenceThreshold}%`
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 5: Escalation Check
    console.log('📈 Checking escalation rules...');
    try {
      const escalateResponse = await fetch(`${supabaseUrl}/functions/v1/escalate-incident`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ incident_id }),
      });

      if (escalateResponse.ok) {
        const escalationResult = await escalateResponse.json();
        results.push({
          step: 'escalation_check',
          status: 'success',
          details: escalationResult,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (escalateError) {
      console.error('Escalation check failed:', escalateError);
      results.push({
        step: 'escalation_check',
        status: 'failed',
        details: { error: String(escalateError) },
        timestamp: new Date().toISOString(),
      });
    }

    // Step 6: Update Metrics
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    await supabase.from('incident_timeline').insert({
      incident_id,
      stage: 'Autonomous SOC Pipeline Complete',
      details: `Processed in ${processingTime}ms. Mode: ${mode}. Steps: ${results.filter(r => r.status === 'success').length}/${results.length} successful.`,
    });

    results.push({
      step: 'update_metrics',
      status: 'success',
      details: { processing_time_ms: processingTime },
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Autonomous SOC Pipeline completed in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      incident_number: incident.incident_number,
      mode,
      processing_time_ms: processingTime,
      pipeline_results: results,
      jira_ticket: jiraTicket,
      summary: {
        steps_total: results.length,
        steps_successful: results.filter(r => r.status === 'success').length,
        steps_failed: results.filter(r => r.status === 'failed').length,
        steps_skipped: results.filter(r => r.status === 'skipped').length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in autonomous-soc pipeline:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      pipeline_results: results,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
