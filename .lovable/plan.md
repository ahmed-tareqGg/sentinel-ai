

# خطة تحسين الـ Functionality — 4 محاور

## 1. Incident Workflow Enhancement

### Smart Auto-Assignment Widget
- إضافة مكون `SmartAutoAssign` في صفحة Incidents يقوم بتوزيع الحوادث الجديدة (status = 'Open', no owner) تلقائياً على المحلل الأقل حملاً عبر query لعدد الحوادث المفتوحة لكل analyst.
- زر "Auto-Assign All Unassigned" في toolbar صفحة Incidents.

### Visual SLA Tracker on Incident List
- إضافة عمود SLA مرئي في `IncidentTable` — progress bar ملون (أخضر → أصفر → أحمر) يعرض الوقت المتبقي لكل حادثة مباشرة في الجدول بدون الحاجة لفتح التفاصيل.

### Incident Quick Actions
- إضافة dropdown في كل صف بالجدول لـ: Assign to me, Escalate, Close as FP — بدون فتح صفحة التفاصيل.

## 2. Dashboard Widgets

### Interactive Top Attackers Widget
- مكون جديد `TopAttackers.tsx` يعرض أكثر 10 src_ip ظهوراً في الحوادث المفتوحة مع عدد الحوادث لكل IP، وربط كل IP بصفحة Threat Intel.

### Risk Score Gauge
- مكون `RiskScoreGauge.tsx` — gauge دائري (SVG) يحسب درجة المخاطر الإجمالية من: عدد الحوادث Critical المفتوحة + SLA breaches + عدد الحوادث بدون owner.

### Incidents by Hour Heatmap
- مكون `IncidentHeatmap.tsx` — heatmap أسبوعي (7 أيام × 24 ساعة) يعرض كثافة الحوادث بالألوان.

## 3. Notifications System Enhancement

### Browser Push Notifications
- إضافة `Notification.requestPermission()` عند أول login ثم استخدام `new Notification()` عند وصول حوادث Critical/High عبر Realtime channel الموجود.
- Toggle في Settings → Notification Preferences.

### Enhanced Toast Notifications
- تحسين الـ SmartAlertBanner ليعرض تفاصيل أكثر (src_ip, MITRE technique) مع زر "Investigate" ينقل مباشرة لصفحة الحادثة.

### Notification Sound Preferences
- إضافة اختيار نوع الصوت (Beep, Chime, Silent) في NotificationPreferences.

## 4. AI Copilot Enhancement

### Context-Aware Suggestions
- إضافة شريط Quick Actions ديناميكي في SOCChatWidget يتغير بناءً على الـ route الحالي:
  - `/incidents/:id` → "Summarize this incident", "Suggest playbook", "Root cause?"
  - `/dashboard` → "Daily briefing", "Top threats", "SLA status"
  - `/compliance` → "Coverage gaps", "Next audit prep"

### Incident Auto-Summarization
- زر "AI Summary" في IncidentDetail header يستدعي soc-chat بسياق الحادثة الكامل (timeline + notes + IOCs) ويعرض ملخص في dialog.

### Conversation Search
- إضافة بحث في conversation history في SOCChatWidget — filter بالعنوان أو المحتوى.

---

## ملخص التنفيذ

| المحور | ملفات جديدة | ملفات معدّلة |
|---|---|---|
| Incident Workflow | `TopAttackersWidget` (مشترك) | `IncidentTable`, `Incidents.tsx` |
| Dashboard Widgets | `TopAttackers.tsx`, `RiskScoreGauge.tsx`, `IncidentHeatmap.tsx` | `Dashboard.tsx` |
| Notifications | — | `SmartAlertBanner.tsx`, `NotificationPreferences.tsx`, `AppLayout.tsx` |
| AI Copilot | — | `SOCChatWidget.tsx`, `IncidentDetail.tsx` |

لا توجد تغييرات في قاعدة البيانات — كل البيانات المطلوبة موجودة بالفعل.

