import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { UploadSessionRequest, ShopeeCookie } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const body: UploadSessionRequest = await req.json()
  const { label, cookies, set_active = true } = body

  if (!label?.trim()) return NextResponse.json({ error: 'Session 名稱為必填' }, { status: 400 })
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return NextResponse.json({ error: 'Cookie 陣列不可為空' }, { status: 400 })
  }

  // 計算最早過期時間
  const expiresTimestamps = cookies
    .map((c: ShopeeCookie) => c.expires)
    .filter(e => e && e > 0)
  const minExpires = expiresTimestamps.length > 0
    ? Math.min(...expiresTimestamps)
    : null
  const expires_at = minExpires ? new Date(minExpires * 1000).toISOString() : null

  // 若 set_active，先把其他 session 設為 inactive
  if (set_active) {
    await supabase.from('sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      label: label.trim(),
      cookies,
      is_active: set_active,
      expires_at,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    session: data,
    expires_at,
    cookie_count: cookies.length,
  })
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('id, label, is_active, last_used_at, expires_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
