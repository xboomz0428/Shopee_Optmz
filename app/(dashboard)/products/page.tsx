import { createSupabaseServerClient } from '@/lib/supabase/server'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      optimization_logs (
        id, status, insights, created_at
      )
    `)
    .eq('user_id', user.id)
    .neq('status', 'inactive')
    .order('created_at', { ascending: false })

  return <ProductsClient initialProducts={products || []} />
}
