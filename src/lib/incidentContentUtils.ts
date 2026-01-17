import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface Incident {
    id: string;
    incident_number: string;
    timestamp: string;
    src_ip: string | null;
    dst_ip: string | null;
    severity: number;
    event_type: string;
    classification: string;
    confidence: number;
    status: string;
    risk_level: string;
    message: string | null;
    file_hash: string | null;
    mitre_technique: string | null;
    mitre_tactic: string | null;
    assigned_to: string | null;
    raw_log: unknown;
    ai_analysis: unknown;
    sandbox_result: unknown;
    evidence: string[] | null;
    recommended_actions: string[] | null;
    created_at: string;
    updated_at: string;
    // Derived fields (optional updates)
    summary?: string;
    description?: string;
}

export function deduplicateText(text: string | null): string {
    if (!text) return '';

    // Split by sentences (dot followed by space using positive lookbehind/lookahead approximation)
    // We'll split by ". " mostly.
    const sentences = text.split(/(?<=[.!?])\s+/);

    const uniqueSentences = new Set<string>();
    const cleanSentences: string[] = [];

    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed && !uniqueSentences.has(trimmed)) {
            uniqueSentences.add(trimmed);
            cleanSentences.push(sentence);
        }
    }

    return cleanSentences.join(' ').trim();
}

interface NormalizedContent {
    headerSummary: string | null;
    bodyDescription: string | null;
}

export function normalizeIncidentContent(incident: Incident): NormalizedContent {
    // Use existing summary/description if available, otherwise use message
    const rawSource = incident.summary || incident.description || incident.message || '';
    const cleanSource = deduplicateText(rawSource);

    // By default, we might treat the first sentence as summary?
    // But the prompt implies comparing full description vs summary.
    // Let's assume 'summary' = cleanSource and 'description' = cleanSource initially
    const summary = cleanSource;
    const description = cleanSource;

    if (!summary) {
        return { headerSummary: null, bodyDescription: null };
    }

    // Logic 3: If description === summary -> render description only
    if (description === summary) {
        return {
            headerSummary: null, // Don't show in header
            bodyDescription: description
        };
    }

    // Logic 3: If description contains summary -> strip summary from description
    if (description.includes(summary)) {
        return {
            headerSummary: summary,
            bodyDescription: description.replace(summary, '').trim()
        };
    }

    // Fallback
    return {
        headerSummary: summary,
        bodyDescription: description
    };
}
