import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ListTodo,
  FolderKanban,
  CalendarDays,
  Video,
  Users,
  MessagesSquare,
  Contact,
  UserPlus,
  Handshake,
  LifeBuoy,
  Sparkles,
  Search,
  BookOpen,
  FileBarChart,
  BarChart3,
  Settings,
  Building2,
  Plug,
  CreditCard,
  ShieldCheck,
} from 'lucide-react'
import type { PermissionKey } from '@/lib/permissions/catalog'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  permission?: PermissionKey
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Tasks', href: '/tasks', icon: ListTodo, permission: 'tasks.view' },
      { label: 'Projects', href: '/projects', icon: FolderKanban, permission: 'projects.view' },
      { label: 'Meetings', href: '/meetings', icon: Video, permission: 'meetings.view' },
      { label: 'Team', href: '/employees', icon: Users, permission: 'employees.view' },
      { label: 'Chat', href: '/chat', icon: MessagesSquare, permission: 'chat.use' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Customers', href: '/crm/customers', icon: Contact, permission: 'customers.view' },
      { label: 'Leads', href: '/crm/leads', icon: UserPlus, permission: 'customers.view' },
      { label: 'Deals', href: '/crm/deals', icon: Handshake, permission: 'customers.view' },
      { label: 'Support', href: '/support', icon: LifeBuoy, permission: 'support.view' },
    ],
  },
  {
    title: 'AI',
    items: [
      { label: 'AI Assistant', href: '/ai', icon: Sparkles, permission: 'ai.use' },
      { label: 'Research', href: '/ai/research', icon: Search, permission: 'ai.research' },
      { label: 'Knowledge Base', href: '/knowledge', icon: BookOpen, permission: 'ai.use' },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Reports', href: '/reports', icon: FileBarChart, permission: 'reports.view' },
      { label: 'Analytics', href: '/reports/analytics', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, permission: 'organization.view' },
      { label: 'Organization', href: '/settings/organization', icon: Building2, permission: 'organization.update' },
      { label: 'Integrations', href: '/integrations', icon: Plug, permission: 'integrations.manage' },
      { label: 'Billing', href: '/settings/billing', icon: CreditCard, permission: 'billing.manage' },
      { label: 'Audit Logs', href: '/settings/audit-logs', icon: ShieldCheck, permission: 'audit.view' },
    ],
  },
]
