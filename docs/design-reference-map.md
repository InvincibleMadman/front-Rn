## Required concrete design references

Codex must not describe the UI as merely “modern”, “tech style”, or “dashboard style”.
Every major page and component must be mapped to concrete reference products or design examples.

### Global design model

The product must use this three-part design model:

1. Landing page: minimal sci-fi product entrance.
2. Regular console: light, compact, high-density workbench.
3. Deep analysis workspace: dark, focused analysis cockpit.

The product must feel like:

* Protocol laboratory
* Risk control console
* Intelligent debugging cockpit

It must not feel like:

* Traditional industrial monitoring platform
* SCADA dashboard
* Generic blue-white admin panel
* Heavy cyberpunk dashboard
* Energy monitoring big screen

### Landing page references

Use these references:

* Apple official website: large restrained hero, whitespace, premium product rhythm.
* Vercel homepage: developer product clarity, CTA rhythm, minimal interaction.
* Figma homepage: visual order, soft motion, polished but not noisy.
* Starfield / Destiny 2 / Cyberpunk 2077 official pages: only for weak sci-fi atmosphere, background depth, subtle spatial motion, and visual drama. Do not copy heavy game marketing layout.

Apply to:

* Landing hero
* CTA group
* Intro copy rhythm
* Background atmosphere
* Skewed three-card demo carousel
* Particle network background

Do not use:

* Login form
* Registration card
* Dense dashboard widgets
* Long marketing sections
* Heavy full-screen game poster layout

### App shell references

Use these references:

* Linear: sidebar hierarchy, navigation selection, calm SaaS shell.
* Figma Web App: clean working area separation and compact controls.
* Google Cloud Console: top global context bar, node/environment switcher, status area organization.

Apply to:

* Sidebar
* Topbar
* AppShell
* Navigation collapse/expand
* Node switcher
* Global status chip
* Theme toggle placement

Specific requirements:

* Sidebar visual baseline: Linear Sidebar.
* Topbar visual baseline: Google Cloud Console top context bar.
* Shell layout baseline: Figma Web App style work area separation.
* Sidebar must be fixed.
* Topbar must be fixed.
* Main area must scroll independently.
* Bottom log dock must be fixed.

### Global log dock references

Use these references:

* VS Code Terminal / bottom panel: fixed operational panel, collapsible, developer-oriented.
* Datadog Logs Explorer: filtering, severity, source grouping, readable dense logs.
* Security analysis console examples from `ui案例`: dark focused runtime atmosphere.

Apply to:

* GlobalLogDock
* Log filters
* Error row click behavior
* Runtime output stream
* Debug output stream
* Offline operation output

Specific requirements:

* It must feel like a runtime cockpit, not a normal content card.
* It must support collapse, expand, clear, filter, source grouping, auto-scroll, pause-scroll.
* All page-local log panels must be removed.
* Error details must open in modal/drawer and be mirrored to GlobalLogDock.

### Dashboard references

Use these references:

* Datadog Dashboard: operational metric hierarchy and trend chart grouping.
* Grafana Dashboard: metric panels, compact chart composition, readable time-series.
* Wiz Console: risk summary cards, severity grouping, security-product clarity.
* `genr/3.png`: business information architecture baseline.
* `ui案例/IMG_1214.JPG`: asymmetric layout pattern.
* `ui案例/IMG_1203.JPG`: compact card density where appropriate.

Apply to:

* Dashboard overview
* KPI cards
* Task summary
* Node health summary
* Recent failure summary
* Trend charts
* Donut KPI indicators

Specific requirements:

* KPI cards must use a compact left-number + right-donut layout.
* Cards include: task total, running, failed, workspace references, offline artifacts, log entries.
* The dashboard must not be a uniform grid only.
* Prefer asymmetric layout: large trend block + narrow status column + staggered KPI/stat blocks.

### Task creation references

Use these references:

* Google Cloud Console resource creation forms: grouped configuration, advanced options, validation.
* Vercel project configuration flow: clean setup rhythm and focused CTA.
* `genr` workflow structure: keep business flow, not old visual style.

Apply to:

* Job create page
* AFL binary selector
* Advanced parameters area
* Protocol/node/path configuration
* Validation and final submit CTA

Specific requirements:

* AFL binary must be a select control, not free text.
* Expose all API-supported options at call sites without modifying API access code.
* Use compact grouped forms, not one long loose form.
* Advanced options should be collapsible.

### Task list references

Use these references:

* Linear Issues list: dense but readable issue/task list.
* Google Cloud Console resource tables: filter bar, resource state, compact metadata.
* GitHub Actions run list: status clarity and lightweight row rhythm.

Apply to:

* Job list table
* Filter search panel
* Status chips
* Row actions
* Sorting controls

Specific requirements:

* Filter controls must cover status, protocol, target, node, fuzzer, schedule, risk, time range, crash/hang/artifact, keyword, sort field, and sort direction.
* Do not keep only execution-status filtering.
* If backend API does not support a filter, implement local filtering and state that clearly.

### Task detail / monitoring references

Use these references:

* Datadog monitor detail page: metric trend + event context.
* Grafana panel detail: time-series focus and metric grouping.
* Wiz risk context view: security finding summary and evidence context.
* `genr/5.png`: business structure baseline.

Apply to:

* Job detail
* Metrics history
* Artifact summary
* Status timeline
* Operation result
* Runtime log integration

Specific requirements:

* Delete residual “事件流 / Event Stream” title components.
* If event content is still useful, integrate it as compact timeline, artifact activity, or log category.
* Do not leave a standalone “事件流” card.

### Offline workbench references

Use these references:

* Google Cloud Console workbench organization: left configuration, right result, clear action hierarchy.
* `genr/4.png`: business workflow baseline.
* `ui案例/IMG_1203.JPG`: compact result and feedback layout.

Apply to:

* Protocol analysis
* Seed generation
* Risk analysis
* Risk preview
* Instrumentation
* Vulnerability document upload/distill
* Knowledge base result pages

Specific requirements:

* Left side: steps, inputs, forms.
* Middle/main: result, generated artifacts, preview.
* Right side: summary, references, status, compact charts.
* Bottom: GlobalLogDock only.
* Remove all internal console/log cards.

### GDB debug references

Use these references:

* VS Code Debug panel: debug sessions, variables/context, execution focus.
* Security analysis cockpit examples from `ui案例`.
* `genr/6.png`: business structure baseline.
* `ui案例/IMG_1203.JPG`: compact three-zone result layout.
* `ui案例/IMG_1205.JPG`: pink-purple accent color in dark chart visuals.

Apply to:

* GDB debug page
* Candidate seed/artifact/session list
* Parameter editor
* Debug report
* Stack/register/evidence cards
* Error/report detail drawers

Specific requirements:

* Left: candidate seed / artifact / session.
* Middle: debug parameters and actions.
* Right: report, conclusion, evidence, stack, registers, crash context.
* Use dark focused analysis cockpit style.
* Card backgrounds must be distinct from the page background.
* Pink-purple accent must be used carefully for charts/highlights.

### Vulnerability knowledge base references

Use these references:

* `ui案例/IMG_1203.JPG`: compact knowledge-processing layout.
* Google Cloud Console workbench structure.
* Wiz / Snyk style for vulnerability severity and evidence chips.

Apply to:

* Vulnerability KB page
* Vuldoc upload/distill workflow
* KB search results
* Summary/stat cards
* Reference pool
* Graph/timeline if present

Specific requirements:

* Left: document source / protocol / vulnerability entries.
* Middle: distill / analysis / generation parameters.
* Right: summary / statistics / references / generation status.
* Output goes to GlobalLogDock.
* Errors open in modal/drawer.

### Tables, filters, and chips references

Use these references:

* Linear Issues: list density, clean row interaction.
* Google Cloud Console tables: resource filtering and metadata grouping.
* Wiz / Snyk: severity chips and risk tags.

Apply to:

* Tables
* Filter panels
* Status chips
* Severity labels
* Risk badges
* Row actions

Specific requirements:

* Avoid heavy old-admin table borders.
* Use readable row height.
* Filter controls must be compact but not tiny.
* Buttons must not use tiny text.
* Risk colors should only be used for risk/security meaning.

### Final design mapping output requirement

At the end of each implementation phase, Codex must output a short mapping table:

| Page/component | Reference product/image | Borrowed design feature | What was intentionally not copied |
| -------------- | ----------------------- | ----------------------- | --------------------------------- |

The final answer must include a complete design mapping table for:

* Landing page
* Sidebar
* Topbar
* GlobalLogDock
* Dashboard KPI cards
* Dashboard charts
* Task create form
* Task list filters
* Task detail page
* Offline workbench
* GDB debug page
* Vulnerability KB page
* Tables and chips
