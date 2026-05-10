import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JiraTicketParams {
  incident_id: string;
  summary: string;
  description: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels?: string[];
  pdf_content?: string; // Base64 encoded PDF
}

function mapSeverityToPriority(severity: number, riskLevel: string): string {
  if (riskLevel === 'Critical' || severity >= 5) return 'Highest';
  if (riskLevel === 'High' || severity >= 4) return 'High';
  if (riskLevel === 'Medium' || severity >= 3) return 'Medium';
  return 'Low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JIRA_API_TOKEN = Deno.env.get('JIRA_API_TOKEN');
    const JIRA_EMAIL = 'tarekaboya2019@gmail.com';
    const JIRA_BASE_URL = 'https://socmind.atlassian.net';
    const JIRA_PROJECT_KEY = 'KAN';

    if (!JIRA_API_TOKEN) {
      console.error('JIRA_API_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Jira not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth: service role or authenticated user with SOC role
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${supabaseKey}`) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: roleData } = await authClient.from('user_roles').select('role').eq('user_id', user.id).single();
      const allowedRoles = ['admin', 'soc_analyst', 'soc_tier_1', 'soc_tier_2', 'soc_tier_3', 'soc_manager', 'grc_engineer', 'ciso'];
      if (!roleData || !allowedRoles.includes(roleData.role)) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { incident_id, summary, description, priority, labels, pdf_content } = await req.json() as JiraTicketParams;

    // Fetch incident details if not provided
    let incidentData = null;
    if (incident_id) {
      const { data } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', incident_id)
        .single();
      incidentData = data;
    }

    const finalSummary = summary || `[SOCMind] ${incidentData?.incident_number || 'New Incident'} - ${incidentData?.event_type || 'Security Alert'}`;
    const finalPriority = priority || mapSeverityToPriority(incidentData?.severity || 3, incidentData?.risk_level || 'Medium');

    // Build description with incident details
    const finalDescription = description || `
h2. Incident Overview
*Incident Number:* ${incidentData?.incident_number || 'N/A'}
*Event Type:* ${incidentData?.event_type || 'Unknown'}
*Severity:* ${incidentData?.severity || 'N/A'}
*Risk Level:* ${incidentData?.risk_level || 'Unknown'}
*Classification:* ${incidentData?.classification || 'Pending'}
*Confidence:* ${incidentData?.confidence || 0}%

h2. Network Details
*Source IP:* ${incidentData?.src_ip || 'N/A'}
*Destination IP:* ${incidentData?.dst_ip || 'N/A'}

h2. Description
${incidentData?.message || 'No description available'}

h2. MITRE ATT&CK
*Tactic:* ${incidentData?.mitre_tactic || 'N/A'}
*Technique:* ${incidentData?.mitre_technique || 'N/A'}

h2. Recommended Actions
${(incidentData?.recommended_actions || []).map((a: string) => `* ${a}`).join('\n') || 'None specified'}

h2. AI Analysis
${JSON.stringify(incidentData?.ai_analysis || {}, null, 2)}

----
_This ticket was automatically created by SOCMind Autonomous SOC_
    `;

    // Create Jira issue
    const auth = base64Encode(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`);
    
    const createIssueResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: JIRA_PROJECT_KEY },
          summary: finalSummary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: finalDescription }]
              }
            ]
          },
          issuetype: { name: 'Task' }, // Use Task as default, can be changed to custom "Incident" type
          priority: { name: finalPriority },
          labels: labels || ['SOCMind', 'Security', incidentData?.risk_level || 'Medium'].filter(Boolean),
        }
      }),
    });

    if (!createIssueResponse.ok) {
      const errorText = await createIssueResponse.text();
      console.error('Jira create issue failed:', createIssueResponse.status, errorText);
      const isUpstreamUnavailable = createIssueResponse.status >= 500 || errorText.includes('temporarily unavailable');
      return new Response(JSON.stringify({
        success: false,
        fallback: isUpstreamUnavailable,
        error: isUpstreamUnavailable ? 'JIRA_SERVICE_UNAVAILABLE' : 'Failed to create Jira ticket',
        message: isUpstreamUnavailable
          ? 'Jira is temporarily unavailable. Please try again in a few minutes.'
          : 'Jira rejected the request.',
        details: errorText,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jiraIssue = await createIssueResponse.json();
    console.log('Created Jira issue:', jiraIssue.key);

    // Attach PDF if provided
    if (pdf_content) {
      try {
        const pdfBytes = Uint8Array.from(atob(pdf_content), c => c.charCodeAt(0));
        const formData = new FormData();
        formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), `Incident_Report_${incidentData?.incident_number || 'unknown'}.pdf`);

        const attachResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${jiraIssue.key}/attachments`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'X-Atlassian-Token': 'no-check',
          },
          body: formData,
        });

        if (attachResponse.ok) {
          console.log('PDF attached to Jira issue');
        } else {
          console.error('Failed to attach PDF:', await attachResponse.text());
        }
      } catch (attachError) {
        console.error('PDF attachment error:', attachError);
      }
    }

    // Update incident timeline
    if (incident_id) {
      await supabase.from('incident_timeline').insert({
        incident_id,
        stage: 'Jira Ticket Created',
        details: `Ticket ${jiraIssue.key} created in Jira. Priority: ${finalPriority}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      jira_key: jiraIssue.key,
      jira_id: jiraIssue.id,
      jira_url: `${JIRA_BASE_URL}/browse/${jiraIssue.key}`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-jira-ticket:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
