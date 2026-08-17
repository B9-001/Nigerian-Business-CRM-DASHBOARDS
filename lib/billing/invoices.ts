import 'server-only'
import { createAdminClient } from '@/lib/database/supabase/admin'
import type { Database } from '@/types/database'

type BillingTransaction = Database['public']['Tables']['billing_transactions']['Row']

function generateInvoiceNumber(): string {
  const now = new Date()
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `INV-${stamp}-${rand}`
}

/**
 * Creates an invoice record for a successfully-paid transaction. No PDF
 * rendering is implemented (pdf_url stays null) — see docs/billing.md
 * "Known limitations". The invoice UI renders the stored fields directly
 * as an on-screen/printable view instead of a generated PDF file.
 */
export async function createInvoiceForTransaction(transaction: BillingTransaction): Promise<void> {
  const admin = createAdminClient()

  await admin.from('invoices').insert({
    organization_id: transaction.organization_id,
    subscription_id: transaction.subscription_id,
    transaction_id: transaction.id,
    invoice_number: generateInvoiceNumber(),
    provider: transaction.provider,
    provider_invoice_id: transaction.provider_transaction_id,
    amount: transaction.amount,
    currency: transaction.currency,
    status: 'PAID',
    invoice_date: new Date().toISOString().slice(0, 10),
    paid_at: transaction.paid_at ?? new Date().toISOString(),
  })
}
