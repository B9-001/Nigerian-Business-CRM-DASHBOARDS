import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { OrgForm } from './org-form'

export default async function OrganizationSettingsPage() {
  const { profile } = await requirePermission(PERMISSIONS.ORGANIZATION_UPDATE)
  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organizations')
    .select('name, currency, timezone')
    .eq('id', profile.organization_id)
    .single()

  return (
    <div>
      <PageHeader title="Organization" />
      <Card>
        <OrgForm organization={organization ?? { name: '', currency: 'NGN', timezone: 'Africa/Lagos' }} />
      </Card>
    </div>
  )
}
