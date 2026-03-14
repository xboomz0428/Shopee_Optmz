import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from './ProductDetailClient'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: product }, { data: logs }, { data: competitors }] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('optimization_logs').select('*').eq('product_id', params.id)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('competitors').select('*').eq('product_id', params.id)
      .order('sold', { ascending: false }).limit(10),
  ])

  if (!product) notFound()

  return <ProductDetailClient product={product} logs={logs || []} competitors={competitors || []} />
}
