import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { incident, iocs, evidence, notes, timeline, investigator } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const iocList = (iocs || []).map((i: any) => `- [${i.ioc_type}] ${i.value} (Confidence: ${i.confidence}, Source: ${i.source})`).join("\n") || "None collected";
    const evidenceList = (evidence || []).map((e: any) => `- [${e.evidence_type}] ${e.title}: ${e.description || 'No description'}`).join("\n") || "None attached";
    const notesList = (notes || []).map((n: any) => `- ${n.author_email} (${n.note_type}): ${n.content}`).join("\n") || "None";
    const timelineList = (timeline || []).map((t: any) => `- ${t.timestamp}: ${t.stage} ${t.details ? '— ' + t.details : ''}`).join("\n") || "No events";

    const prompt = `You are a Senior SOC Analyst at SOCMind.

Generate a professional incident investigation report based on the following data:

## Incident Details
- **Incident ID**: ${incident.incident_number}
- **Event Type**: ${incident.event_type}
- **Severity**: ${incident.severity}/5
- **Risk Level**: ${incident.risk_level}
- **Classification**: ${incident.classification}
- **AI Confidence**: ${incident.confidence}%
- **Status**: ${incident.status}
- **Source IP**: ${incident.src_ip || 'N/A'}
- **Destination IP**: ${incident.dst_ip || 'N/A'}
- **MITRE Tactic**: ${incident.mitre_tactic || 'N/A'}
- **MITRE Technique**: ${incident.mitre_technique || 'N/A'}

## Description
${incident.message || 'No description available'}

## Timeline
${timelineList}

## Indicators of Compromise (IOCs)
${iocList}

## Evidence
${evidenceList}

## Analyst Notes
${notesList}

## Investigator
- **Name**: ${investigator.name}
- **Role**: ${investigator.role}
- **Organization**: SOCMind
- **Date**: ${new Date().toISOString().split('T')[0]}

---

The report MUST include ALL of the following sections in Markdown:

1. **Executive Summary** — 2-3 sentence overview for CISO/Management
2. **Incident Overview** — Key facts table
3. **Technical Findings** — What was detected, how, evidence chain
4. **IOC Analysis** — Each IOC with context and threat intel
5. **Impact Assessment** — What was/could be affected, blast radius
6. **Recommendations & Mitigation Steps** — Numbered actionable steps
7. **Attribution & Threat Context** — If applicable, link to known threat actors/campaigns
8. **Investigator Details** — Name, Role, Organization, Date, Signature line

**Tone**: Professional, SOC-grade, suitable for CISO / Management review.
**Format**: Clean Markdown with headers, tables, and bullet points.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a senior cybersecurity analyst generating professional investigation reports. Output clean Markdown only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const reportContent = data.choices?.[0]?.message?.content || "Report generation failed.";

    return new Response(JSON.stringify({ report: reportContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-investigation-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
