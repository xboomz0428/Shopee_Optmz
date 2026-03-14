import { createSupabaseServerClient } from '@/lib/supabase/server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, label, is_active, last_used_at, expires_at, created_at, cookie_count:cookies')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <SettingsClient sessions={sessions || []} />
}
