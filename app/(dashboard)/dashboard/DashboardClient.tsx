'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardStats } from '@/types'
import { Package, TrendingUp, Zap, ArrowRight, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Props { stats: DashboardStats }

export default function DashboardClient({ stats }: Props) {
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const router = useRouter()

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault()
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopee_url: url, include_competitors: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '爬取失敗')
      router.push(`/products/${data.product.id}`)
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : '未知錯誤')
    } finally {
      setScraping(false)
    }
  }

  const statCards = [
    { label: '總商品數', value: stats.total_products, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: '已優化商品', value: stats.optimized_products, icon: Zap, color: 'text-shopee-orange', bg: 'bg-orange-50' },
    { label: '平均分數提升', value: `+${stats.avg_score_improvement}`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">儀表板</h1>
        <p className="text-gray-500 text-sm mt-1">歡迎回到 Shopee Cloud Optimizer</p>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快速爬取表單 */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">快速分析商品</h2>
        <form onSubmit={handleScrape} className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="input flex-1"
            placeholder="貼上蝦皮商品網址，例如 https://shopee.tw/..."
            required
          />
          <button type="submit" className="btn-primary flex items-center gap-2 whitespace-nowrap" disabled={scraping}>
            {scraping ? '爬取中...' : <><Zap className="w-4 h-4" /> 開始分析</>}
          </button>
        </form>
        {scrapeError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {scrapeError}
          </div>
        )}
      </div>

      {/* 最近優化紀錄 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">最近優化紀錄</h2>
          <button onClick={() => router.push('/products')} className="text-sm text-shopee-orange flex items-center gap-1 hover:underline">
            查看全部 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {stats.recent_logs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">尚無優化紀錄，請先新增商品並進行分析</p>
        ) : (
          <div className="space-y-3">
            {stats.recent_logs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{log.original_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: zhTW })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {log.insights && (
                    <div className="text-right">
                      <span className="text-xs text-gray-400">分數</span>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span className="text-gray-500">{(log.insights as { score_before?: number }).score_before}</span>
                        <ArrowRight className="w-3 h-3 text-green-500" />
                        <span className="text-green-500">{(log.insights as { score_after?: number }).score_after}</span>
                      </div>
                    </div>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    log.status === 'applied' ? 'bg-green-100 text-green-700' :
                    log.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{
                    log.status === 'applied' ? '已套用' :
                    log.status === 'completed' ? '待套用' : log.status
                  }</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
