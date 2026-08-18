-- Add the Report Agent to the set of valid ai_conversations.agent_type
-- values (CLAUDE.md #51 lists 8 agents: Executive, Research, Task,
-- Meeting, CRM, Support, Knowledge, Report — REPORT was missing from the
-- original check constraint).
alter table public.ai_conversations drop constraint if exists ai_conversations_agent_type_check;
alter table public.ai_conversations add constraint ai_conversations_agent_type_check
  check (agent_type in ('EXECUTIVE', 'RESEARCH', 'TASK', 'MEETING', 'CRM', 'SUPPORT', 'KNOWLEDGE', 'REPORT'));
