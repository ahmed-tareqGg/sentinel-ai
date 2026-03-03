

# Update Demo Guide PDF with All New Features

## What Changed Since Last Update
The Demo Guide PDF currently covers 18 sections but is missing several major features built recently:

### New Sections to Add (in Table of Contents + detailed pages):

1. **SOAR Actions Dashboard (Real-Time Pipeline Monitor)** — New dedicated page at `/soar-actions` with live status tracking (pending/dispatched/completed/failed), assigned agents, retry counts, timeout tracking, and realtime updates via WebSocket.

2. **Production SOAR Engine Architecture** — Atomic action claiming via PostgreSQL RPC (`claim_soar_actions`) using `FOR UPDATE SKIP LOCKED`, state machine (pending → dispatched → success/failed), timeout + auto-requeue, DNS resolution for hostname targets.

3. **Multi-Model AI Orchestration (Smart AI Router)** — Intent-based routing across multiple AI models (GPT-5, Gemini 2.5/3, Flash variants), Rule Engine + Cache layers, Quality Guard with automatic escalation, confidence scoring.

4. **War Room** — Per-incident collaboration space with real-time chat, task management, IOC tracking, and timeline.

5. **Attack Simulator** — AI-powered training scenarios with MITRE-aligned attack simulations, difficulty levels, and scoring.

6. **Executive Dashboard** — CISO-level view with KPIs, risk posture charts, analyst leaderboard, and financial impact metrics.

7. **Agent Platform** — Full agent lifecycle management: deploy, monitor health, configure, execute SOAR actions remotely.

8. **Correlation Rules Engine** — Custom detection rules with conditions, thresholds, time windows, and auto-incident creation.

9. **Notification Center** — Real-time in-app notifications with categories, read/unread, and SLA breach alerts.

10. **Command Palette** — `⌘K` keyboard shortcut for instant navigation and quick actions across the platform.

11. **Analyst Gamification & Leaderboard** — Score-based ranking system tracking resolutions, notes, chat activity.

12. **SLA Breach Monitor** — Proactive SLA monitoring with automatic breach alerts.

### Existing Sections to Update:

- **AI Models section** (Section 18): Update from "Gemini 2.5 Flash only" to full Multi-Model architecture
- **Playbooks section** (Section 6): Add SOAR Actions Dashboard details and production engine info
- **Version badge**: Update from v3.0 to v4.0
- **Cover stats**: Add "Multi-Model AI" and "Real-Time SOAR" stats

## Implementation Plan

### File: `src/lib/demoGuideGenerator.ts`

1. **Update cover page** — Version v3.0 → v4.0, add new stat card for "6+ AI Models"
2. **Expand Table of Contents** — Add sections 19-28 for all new features
3. **Add new section pages** with `sectionHeader`, `featureTable`, `bulletList` for each feature above
4. **Update Section 18 (Architecture)** — Expand AI Models subsection with full multi-model details, add SOAR Engine architecture subsection
5. **Update Section 6 (Playbooks)** — Add SOAR Actions Dashboard and Production Engine rows

Total: ~12 new sections added, 3 existing sections updated, version bump. The PDF will grow from ~18 to ~28 content sections with proper page breaks and consistent styling.

