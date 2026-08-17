# DESIGN.md — Nigerian Business Operating System

## 1. Product Design Direction

Build a premium, modern Business Operating System dashboard for Nigerian organizations. Visual direction: clean SaaS dashboard, white/light-gray canvas, deep emerald green as the primary brand color, large rounded cards, soft shadows, spacious layout, clear hierarchy, minimal borders, compact-but-readable data, rounded buttons, small status pills, modern avatars, responsive widget grid.

The reference dashboard image is inspiration for layout, spacing, hierarchy and interaction patterns only — its logo, text and branding are never copied. The product should feel like a combination of a modern CRM, a project-management platform, a team collaboration tool, an executive business dashboard and an AI workspace. Professional enough for Nigerian SMEs, startups, NGOs, agencies and larger organizations.

## 2. Brand Personality

Communicate: trust, control, productivity, intelligence, professionalism, simplicity, speed.

Avoid: excessive gradients, overly colorful dashboards, glassmorphism everywhere, excessive animation, dense enterprise tables as the default, visually noisy cards.

Primary visual language: white surfaces + deep green accents + charcoal text + subtle neutral backgrounds.

## 3. Design Tokens

```css
--primary: #087443;
--primary-dark: #045A34;
--primary-soft: #E8F5EF;
--primary-hover: #06653B;
--background: #F5F7F6;
--surface: #FFFFFF;
--surface-muted: #F8FAF9;
--text-primary: #111817;
--text-secondary: #66716D;
--text-muted: #8A9490;
--border: #E5EAE7;
--success: #168A52;
--warning: #D99A17;
--danger: #D94B4B;
--info: #3678D4;
--overlay: rgba(0, 0, 0, 0.35);
```

Tokens are exposed as CSS variables (see `app/globals.css`) so an organization can eventually customize its brand colors.

## 4. Typography

Modern sans-serif — Inter (default), with Geist / Plus Jakarta Sans as alternatives.

| Role | Size / Weight |
|---|---|
| Page title | 28–34px / 700 |
| Section title | 18–22px / 600 |
| Card title | 14–16px / 600 |
| Body | 14px / 400 |
| Small text | 12–13px / 400 |
| Metric | 30–40px / 700 |
| Button | 13–14px / 600 |

Avoid excessively large headings inside dashboard cards.

## 5. Application Shell

```
┌─────────┬───────────────────────────────────────────┐
│ Sidebar │ Topbar                                     │
│         ├───────────────────────────────────────────┤
│         │            Main Dashboard Content          │
└─────────┴───────────────────────────────────────────┘
```

Sidebar: 240–260px expanded, 72–80px collapsed. Topbar: 64–76px, white, subtle bottom border/shadow, search left/center, notifications, messages, organization switcher, user menu. Main content: max-width ~1600px, padding 24–32px desktop / 16px mobile.

## 6. Sidebar Navigation

Workspace: Dashboard, My Tasks, Projects, Calendar, Meetings, Team, Chat.
CRM: Customers, Leads, Deals, Support.
AI: AI Assistant, Research, Knowledge Base, AI Reports.
Business: Analytics, Reports, Documents, Automations.
Administration: Settings, Organization, Integrations, Billing, Audit Logs.

Simple line icons. Active nav: soft green background, green icon/text, optional 3–4px vertical active indicator.

## 7. Dashboard Page

Header — left: "Dashboard" / "Good morning, {name}. Here's what's happening across your organization." Right: Create button, quick action, optional date/filter control.

KPI row: 4–5 responsive metric cards (Active Projects, Open Tasks, Team Members, Open Tickets, ...). Only the primary KPI card uses the dark-green treatment — not every card is green.

## 8. Dashboard Widget Grid (desktop)

```
┌───────────────────────────── KPI cards ─────────────────────────────┐
├───────────────────────────────┬─────────────────┬───────────────────┤
│ Work / Project Analytics       │ Upcoming Meetings│ Quick Actions     │
├───────────────────────────────┼─────────────────┼───────────────────┤
│ Team Collaboration             │ Project Progress │ AI Insights       │
├───────────────────────────────┴─────────────────┴───────────────────┤
│ Recent Activity / Tasks / Business Overview                          │
└────────────────────────────────────────────────────────────────────┘
```

Built with CSS Grid, not hardcoded positioning.

## 9. Project / Work Analytics

Tasks completed by day, projects completed, workload, department activity. Minimal, accessible, responsive, clearly labeled — no decorative charts without informational value.

## 10. Upcoming Meetings Widget

Title, time, provider badge (Google Meet / Zoom), participants, Join button. Current/imminent meeting uses a strong primary-green CTA.

## 11. Quick Actions

Compact card: Create Task, Add Customer, Schedule Meeting, Create Project, Start AI Research, Upload Document. Open drawers/modals rather than navigating away where possible.

## 12. Team Collaboration Widget

Avatar, employee name, current task, project, status. Clicking a member opens a side panel rather than navigating away where practical.

## 13. Project Progress

Donut/gauge visualization: overall completion % with legend (Completed / In Progress / Pending). Supports department/project filtering.

## 14. AI Insights Card

Example: "3 projects are at risk of missing their deadlines." / "Marketing has 8 overdue tasks." / "Support tickets increased 18% this week." Subtle green AI iconography. Predictions are always clearly labeled as AI-generated insights, never presented as fact.

## 15. Time / Productivity Widget

Time tracker (start/pause/stop) tied to a task, showing elapsed time and current task name.

## 16. Task Page

List / Kanban / Calendar / Timeline views. Task cards show priority, assignee, due date, project, status, comments, attachments. Drag-and-drop updates status safely (optimistic + server-confirmed).

## 17. Project Page

Header: name, owner, status, deadline, progress, Add Task. Tabs: Overview, Tasks, Timeline, Files, Meetings, Team, Activity, AI. AI tab: summarize project, identify risks, find overdue work, generate status report.

## 18. Team Page

Employee directory cards: avatar, name, role, department, availability, current task, workload. Filters: department, role, status, team.

## 19. CRM Pages

Customers: table + card views. Leads: Kanban pipeline. Deals: pipeline columns `New → Contacted → Qualified → Proposal → Negotiation → Won/Lost`. Support: ticket list with priority, SLA/status, assignee, customer, last activity.

## 20. AI Workspace

Premium workspace, not a generic chat page: suggested actions row, conversation, streaming responses, sources for web research, tool/action confirmation, file attachments, conversation history.

## 21. Research Workspace

Search box, research type, date range, sources, results, AI summary, full report, save/export. Clearly distinguishes source data, AI summary and AI inference.

## 22. Meeting Center

Calendar, upcoming/past meetings, meeting details (provider, agenda, participants, notes, transcript, AI summary, action items). Users can join without leaving the platform.

## 23. Responsive Design

Desktop: sidebar visible, multi-column dashboard. Tablet: collapsible sidebar, 2-column cards, responsive tables. Mobile: bottom nav / compact drawer, one-column cards, horizontally scrollable KPI row, sticky primary actions, full-screen drawers/modals. Never allow horizontal page overflow.

## 24. Component Style

Cards: radius 16–20px, white background, subtle border, very soft shadow, 18–24px padding.
Buttons: radius 10–12px, primary dark green, secondary white+border, destructive red.
Inputs: radius 10–12px, height 42–46px, clear focus state.
Badges: rounded/pill, small, semantic colors.

## 25. Interaction Principles

Use hover states, skeleton loading, empty states, optimistic updates where safe, toasts, confirmation dialogs for destructive actions, keyboard shortcuts, command palette. Avoid long blocking spinners, full-page reloads, excessive modal stacking, unnecessary animation.

## 26. Motion

150–250ms transitions: fade, scale, slide, progress animations. Respect `prefers-reduced-motion`.

## 27. Accessibility

Target WCAG 2.2 AA: keyboard navigation, visible focus states, semantic HTML, ARIA only when needed, accessible forms, screen-reader labels, sufficient contrast, reduced-motion support. Never use color as the only status indicator.

## 28. Nigerian Business Context

₦ NGN, Africa/Lagos timezone, +234 phone numbers, Nigerian date/time conventions, local business workflows, department/approval structures. Globally professional visual language, not stereotyped.

## 29. Design System Architecture

Tokens: `--background --surface --surface-muted --foreground --muted-foreground --primary --primary-foreground --border --success --warning --danger --info --radius`.

Reusable components: `Card, MetricCard, DataTable, StatusBadge, AvatarGroup, EmptyState, Skeleton, Drawer, Modal, CommandMenu, PageHeader, SectionHeader, ChartCard, ActivityItem, QuickAction, MeetingCard, TaskCard`. Never duplicate styling ad hoc.

## 30. Performance Design

Server-render data where appropriate, stream AI responses, lazy-load heavy charts, paginate large datasets, virtualize very large lists, cache stable data, use realtime selectively, avoid unnecessary client components, avoid loading all dashboard data in one request, use skeleton states. Long AI/research/report jobs run in background workers, never inline in a request.

## 31. Final Visual Goal

"A premium Nigerian business command center" — white/soft-gray background, deep green accent, rounded dashboard cards, clean left sidebar, top search bar, KPI cards, analytics, team collaboration, project progress, meeting reminders, time tracking — expanded into the full Business Operating System. Original product design system, inspired by but never a clone of the reference image.
