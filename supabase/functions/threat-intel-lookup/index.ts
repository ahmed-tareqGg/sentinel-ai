import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, ioc_value, ioc_type, incident_id, providers } = await req.json();

    console.log(`TI Lookup: ${action} - ${ioc_type}:${ioc_value}`);

    if (action === 'lookup') {
      const results: Record<string, any> = {};
      const selectedProviders = providers || ['virustotal', 'abuseipdb', 'alienvault'];

      // VirusTotal lookup
      if (selectedProviders.includes('virustotal')) {
        const vtKey = Deno.env.get('VIRUSTOTAL_API_KEY');
        if (vtKey) {
          try {
            let vtUrl = '';
            if (ioc_type === 'ip') {
              vtUrl = `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ioc_value)}`;
            } else if (ioc_type === 'domain') {
              vtUrl = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(ioc_value)}`;
            } else if (ioc_type === 'file_hash') {
              vtUrl = `https://www.virustotal.com/api/v3/files/${encodeURIComponent(ioc_value)}`;
            } else if (ioc_type === 'url') {
              const urlId = btoa(ioc_value).replace(/=/g, '');
              vtUrl = `https://www.virustotal.com/api/v3/urls/${urlId}`;
            }

            if (vtUrl) {
              const vtRes = await fetch(vtUrl, {
                headers: { 'x-apikey': vtKey },
              });
              if (vtRes.ok) {
                const vtData = await vtRes.json();
                const attrs = vtData.data?.attributes || {};
                const stats = attrs.last_analysis_stats || {};
                results.virustotal = {
                  malicious: stats.malicious || 0,
                  suspicious: stats.suspicious || 0,
                  harmless: stats.harmless || 0,
                  undetected: stats.undetected || 0,
                  reputation: attrs.reputation,
                  country: attrs.country,
                  as_owner: attrs.as_owner,
                  tags: attrs.tags || [],
                  categories: attrs.categories || {},
                  threat_score: Math.min(100, (stats.malicious || 0) * 5 + (stats.suspicious || 0) * 2),
                };
              } else {
                results.virustotal = { error: `HTTP ${vtRes.status}` };
              }
            }
          } catch (e) {
            results.virustotal = { error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      }

      // AbuseIPDB lookup (IP only)
      if (selectedProviders.includes('abuseipdb') && (ioc_type === 'ip')) {
        const abuseKey = Deno.env.get('ABUSEIPDB_API_KEY');
        if (abuseKey) {
          try {
            const abuseRes = await fetch(
              `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ioc_value)}&maxAgeInDays=90&verbose`,
              { headers: { 'Key': abuseKey, 'Accept': 'application/json' } }
            );
            if (abuseRes.ok) {
              const abuseData = await abuseRes.json();
              const d = abuseData.data || {};
              results.abuseipdb = {
                abuse_confidence_score: d.abuseConfidenceScore || 0,
                country_code: d.countryCode,
                isp: d.isp,
                domain: d.domain,
                total_reports: d.totalReports || 0,
                num_distinct_users: d.numDistinctUsers || 0,
                last_reported_at: d.lastReportedAt,
                is_whitelisted: d.isWhitelisted || false,
                is_tor: d.isTor || false,
                usage_type: d.usageType,
                categories: d.reports?.slice(0, 5)?.map((r: any) => r.categories).flat() || [],
                threat_score: d.abuseConfidenceScore || 0,
              };
            } else {
              results.abuseipdb = { error: `HTTP ${abuseRes.status}` };
            }
          } catch (e) {
            results.abuseipdb = { error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      }

      // AlienVault OTX lookup
      if (selectedProviders.includes('alienvault')) {
        const otxKey = Deno.env.get('ALIENVAULT_OTX_API_KEY');
        if (otxKey) {
          try {
            let otxUrl = '';
            if (ioc_type === 'ip') {
              otxUrl = `https://otx.alienvault.com/api/v1/indicators/IPv4/${encodeURIComponent(ioc_value)}/general`;
            } else if (ioc_type === 'domain') {
              otxUrl = `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(ioc_value)}/general`;
            } else if (ioc_type === 'file_hash') {
              otxUrl = `https://otx.alienvault.com/api/v1/indicators/file/${encodeURIComponent(ioc_value)}/general`;
            } else if (ioc_type === 'url') {
              otxUrl = `https://otx.alienvault.com/api/v1/indicators/url/${encodeURIComponent(ioc_value)}/general`;
            }

            if (otxUrl) {
              const otxRes = await fetch(otxUrl, {
                headers: { 'X-OTX-API-KEY': otxKey },
              });
              if (otxRes.ok) {
                const otxData = await otxRes.json();
                const pulses = otxData.pulse_info?.pulses || [];
                results.alienvault = {
                  pulse_count: otxData.pulse_info?.count || 0,
                  reputation: otxData.reputation || 0,
                  country_code: otxData.country_code,
                  asn: otxData.asn,
                  pulses: pulses.slice(0, 5).map((p: any) => ({
                    name: p.name,
                    description: p.description?.slice(0, 200),
                    created: p.created,
                    tags: p.tags?.slice(0, 5),
                    adversary: p.adversary,
                    targeted_countries: p.targeted_countries?.slice(0, 5),
                    attack_ids: p.attack_ids?.slice(0, 5),
                  })),
                  tags: otxData.pulse_info?.pulses?.flatMap((p: any) => p.tags || []).slice(0, 10) || [],
                  threat_score: Math.min(100, (otxData.pulse_info?.count || 0) * 10),
                };
              } else {
                results.alienvault = { error: `HTTP ${otxRes.status}` };
              }
            }
          } catch (e) {
            results.alienvault = { error: e instanceof Error ? e.message : 'Unknown error' };
          }
        }
      }

      // Calculate aggregate threat score
      const scores = Object.values(results)
        .filter((r: any) => r.threat_score !== undefined)
        .map((r: any) => r.threat_score as number);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Store in threat_intel_iocs
      const categories = [
        ...new Set(
          Object.values(results).flatMap((r: any) => r.tags || r.categories || [])
        ),
      ].slice(0, 10);

      const { data: existingIoc } = await supabase
        .from('threat_intel_iocs')
        .select('id')
        .eq('ioc_type', ioc_type)
        .eq('value', ioc_value)
        .eq('source', 'multi_source')
        .maybeSingle();

      if (existingIoc) {
        await supabase.from('threat_intel_iocs').update({
          threat_score: avgScore,
          confidence: Math.min(100, scores.length * 33),
          categories: categories as string[],
          source_data: results,
          last_seen: new Date().toISOString(),
          country_code: results.abuseipdb?.country_code || results.virustotal?.country || results.alienvault?.country_code,
          isp: results.abuseipdb?.isp || results.virustotal?.as_owner,
          is_whitelisted: results.abuseipdb?.is_whitelisted || false,
          related_incident_ids: incident_id ? [incident_id] : [],
        }).eq('id', existingIoc.id);
      } else {
        await supabase.from('threat_intel_iocs').insert({
          ioc_type,
          value: ioc_value,
          threat_score: avgScore,
          confidence: Math.min(100, scores.length * 33),
          categories: categories as string[],
          tags: Object.values(results).flatMap((r: any) => r.tags || []).slice(0, 10) as string[],
          source: 'multi_source',
          source_data: results,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          country_code: results.abuseipdb?.country_code || results.virustotal?.country || results.alienvault?.country_code,
          isp: results.abuseipdb?.isp || results.virustotal?.as_owner,
          is_whitelisted: results.abuseipdb?.is_whitelisted || false,
          related_incident_ids: incident_id ? [incident_id] : [],
        });
      }

      // Log enrichment
      for (const [provider, data] of Object.entries(results)) {
        await supabase.from('ti_enrichment_logs').insert({
          ioc_value,
          ioc_type,
          provider,
          request_status: (data as any).error ? 'error' : 'success',
          response_data: data,
          error_message: (data as any).error || null,
          incident_id: incident_id || null,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        ioc_value,
        ioc_type,
        threat_score: avgScore,
        confidence: Math.min(100, scores.length * 33),
        providers: results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'bulk_lookup') {
      // For enriching multiple IOCs at once
      const { iocs } = await req.json();
      const lookupResults = [];

      for (const ioc of (iocs || []).slice(0, 10)) {
        try {
          // Recursive call with single lookup
          const singleRes = await fetch(`${supabaseUrl}/functions/v1/threat-intel-lookup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              action: 'lookup',
              ioc_value: ioc.value,
              ioc_type: ioc.type,
              incident_id: ioc.incident_id,
            }),
          });
          lookupResults.push(await singleRes.json());
        } catch (e) {
          lookupResults.push({ error: e instanceof Error ? e.message : 'Failed', ioc });
        }
      }

      return new Response(JSON.stringify({ success: true, results: lookupResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'get_dashboard') {
      // Dashboard aggregation
      const { data: iocs } = await supabase
        .from('threat_intel_iocs')
        .select('*')
        .order('threat_score', { ascending: false })
        .limit(100);

      const { data: recentLogs } = await supabase
        .from('ti_enrichment_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: actors } = await supabase
        .from('threat_actors')
        .select('*')
        .order('last_activity', { ascending: false })
        .limit(20);

      const { data: feeds } = await supabase
        .from('threat_feeds')
        .select('*')
        .order('last_fetched', { ascending: false });

      // Stats
      const totalIocs = iocs?.length || 0;
      const criticalIocs = iocs?.filter(i => i.threat_score >= 70).length || 0;
      const countries = [...new Set(iocs?.map(i => i.country_code).filter(Boolean))];

      return new Response(JSON.stringify({
        success: true,
        dashboard: {
          total_iocs: totalIocs,
          critical_iocs: criticalIocs,
          unique_countries: countries.length,
          top_iocs: iocs?.slice(0, 20) || [],
          recent_enrichments: recentLogs || [],
          threat_actors: actors || [],
          feeds: feeds || [],
          country_distribution: countries,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('TI Lookup error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
