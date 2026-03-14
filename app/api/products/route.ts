import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CreateProductRequest } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status') || 'active'
  const search = searchParams.get('search') || ''

  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase.from('products').select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .neq('status', 'inactive')

  if (status !== 'all') query = query.eq('status', status)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data: products, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ products: products || [], total: count || 0 })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const body: CreateProductRequest = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: '商品名稱為必填' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name: body.name.trim(),
      description: body.description,
      price: body.price,
      shopee_url: body.shopee_url,
      category: body.category,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
