import { createSupabaseServerClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'
import type { DashboardStats } from '@/types'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 並行查詢統計數據
  const [
    { count: totalProducts },
    { count: optimizedProducts },
    { data: recentLogs },
    { data: scoreData },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'active'),
    supabase.from('optimization_logs').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'applied'),
    supabase.from('optimization_logs').select('*')
      .eq('user_id', user.id)
      .in('status', ['completed', 'applied'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('optimization_logs').select('insights')
      .eq('user_id', user.id)
      .in('status', ['completed', 'applied']),
  ])

  // 計算平均分數提升
  let avgImprovement = 0
  if (scoreData && scoreData.length > 0) {
    const improvements = scoreData
      .map(row => {
        const ins = row.insights as { score_before?: number; score_after?: number } | null
        return ins ? (ins.score_after || 0) - (ins.score_before || 0) : 0
      })
      .filter(v => v > 0)
    avgImprovement = improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0
  }

  const stats: DashboardStats = {
    total_products: totalProducts || 0,
    optimized_products: optimizedProducts || 0,
    avg_score_improvement: Math.round(avgImprovement),
    recent_logs: recentLogs || [],
  }

  return <DashboardClient stats={stats} />
}
