import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/session'
import { createClient } from '@/lib/database/supabase/server'
import { PERMISSIONS } from '@/lib/permissions/catalog'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { formatNaira, formatDate } from '@/lib/utils'
import { PrintButton } from './print-button'

/**
 * On-screen/printable invoice view. No PDF file is generated server-side
 * (pdf_url stays null on the invoices row) — "Download PDF" uses the
 * browser's native print-to-PDF via window.print() instead. See
 * docs/billing.md "Known limitations" for the tradeoff.
 */
export default async function InvoicePage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const { profile } = await requirePermission(PERMISSIONS.BILLING_MANAGE)
  const supabase = await createClient()

  const { data: transaction } = await supabase
    .from('billing_transactions')
    .select('id, reference, amount, currency, status, plan_id, created_at, paid_at')
    .eq('organization_id', profile.organization_id)
    .eq('reference', reference)
    .maybeSingle()

  if (!transaction) notFound()

  const [{ data: invoice }, { data: organization }, { data: plan }] = await Promise.all([
    supabase.from('invoices').select('*').eq('transaction_id', transaction.id).maybeSingle(),
    supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
    transaction.plan_id ? supabase.from('plans').select('name').eq('id', transaction.plan_id).single() : Promise.resolve({ data: null }),
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <Card className="p-10">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <p className="text-lg font-bold text-primary">Nigerian Business OS</p>
            <p className="text-xs text-muted-foreground">support@businessos.example</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{invoice?.invoice_number ?? transaction.reference}</p>
            <p className="text-xs text-muted-foreground">{formatDate(invoice?.invoice_date ?? transaction.created_at)}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Billed to</p>
            <p className="text-sm text-foreground">{organization?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
            <StatusBadge status={transaction.status} />
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="py-3 text-foreground">{plan?.name ?? 'Subscription'} plan — BusinessOS subscription</td>
              <td className="py-3 text-right text-foreground">{formatNaira(transaction.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right text-sm font-semibold text-foreground">Total</td>
              <td className="pt-4 text-right text-lg font-bold text-foreground">{formatNaira(transaction.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 border-t border-border pt-4 text-xs text-subtle">
          <p>Provider reference: {transaction.reference}</p>
          {transaction.paid_at && <p>Paid: {formatDate(transaction.paid_at)}</p>}
        </div>
      </Card>
    </div>
  )
}
