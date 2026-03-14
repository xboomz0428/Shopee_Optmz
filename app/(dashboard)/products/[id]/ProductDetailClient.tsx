'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import type { Product, OptimizationLog, Competitor, OptimizationStreamEvent } from '@/types'
import {
  Zap, RefreshCw, Check, AlertCircle, ArrowRight,
  ExternalLink, Package, ChevronDown, ChevronUp
} from 'lucide-react'

interface Props {
  product: Product
  logs: OptimizationLog[]
  competitors: Competitor[]
}

export default function ProductDetailClient({ product, logs: initialLogs, competitors }: Props) {
  const searchParams = useSearchParams()
  const [logs, setLogs] = useState(initialLogs)
  const [analyzing, setAnalyzing] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [expandDesc, setExpandDesc] = useState(false)
  const latestLog = logs[0] || null
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)

  useEffect(() => {
    if (searchParams.get('action') === 'analyze') {
      handleAnalyze()
    }
  }, [])

  async function handleScrape() {
    setScraping(true)
    setError('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopee_url: product.shopee_url, product_id: product.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '爬取失敗')
    } finally {
      setScraping(false)
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setError('')
    setStatusMsg('準備分析...')
    setProgress(0)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      const reader = res.body!.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event: OptimizationStreamEvent = JSON.parse(line.slice(6))
            if (event.type === 'status') setStatusMsg(event.message)
            if (event.type === 'progress') setProgress((event.step / event.total) * 100)
            if (event.type === 'result') {
              setLogs(prev => [event.log, ...prev])
              setStatusMsg('分析完成！')
              setProgress(100)
            }
            if (event.type === 'error') throw new Error(event.message)
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失敗')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleApply(logId: string) {
    const res = await fetch(`/api/optimization-logs/${logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'applied' }),
    })
    if (res.ok) {
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'applied' as const, applied_at: new Date().toISOString() } : l))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 line-clamp-2">{product.name}</h1>
          {product.shopee_url && (
            <a href={product.shopee_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-shopee-orange flex items-center gap-1 mt-1 hover:underline">
              在蝦皮查看 <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleScrape} className="btn-secondary text-sm flex items-center gap-1" disabled={scraping}>
            <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
            {scraping ? '爬取中...' : '更新資料'}
          </button>
          <button onClick={handleAnalyze} className="btn-primary text-sm flex items-center gap-1" disabled={analyzing}>
            <Zap className="w-4 h-4" />
            {analyzing ? '分析中...' : 'AI 優化'}
          </button>
        </div>
      </div>

      {/* 分析進度 */}
      {analyzing && (
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-5 h-5 text-shopee-orange animate-pulse" />
            <span className="text-sm font-medium text-shopee-orange-dark">{statusMsg}</span>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2">
            <div className="bg-shopee-orange h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 商品基本資訊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
            {product.image_url ? (
              <Image src={product.image_url} alt={product.name}
                width={300} height={300} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-12 h-12 text-gray-300" />
              </div>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">售價</span>
              <span className="font-semibold text-shopee-orange">
                {product.price ? `NT$ ${product.price.toLocaleString()}` : '-'}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">銷量</span><span>{product.sold}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">庫存</span><span>{product.stock}</span></div>
            {product.category && (
              <div className="flex justify-between"><span className="text-gray-500">分類</span><span>{product.category}</span></div>
            )}
          </div>
        </div>

        {/* 優化前後對比 */}
        <div className="lg:col-span-2 space-y-4">
          {latestLog ? (
            <>
              {/* 分數對比 */}
              {latestLog.insights && (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">優化分數</h3>
                    {latestLog.status !== 'applied' && (
                      <button onClick={() => handleApply(latestLog.id)}
                        className="btn-primary text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" /> 套用此優化
                      </button>
                    )}
                    {latestLog.status === 'applied' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> 已套用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-400">{latestLog.insights.score_before}</div>
                      <div className="text-xs text-gray-400 mt-1">優化前</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-shopee-orange" />
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-500">{latestLog.insights.score_after}</div>
                      <div className="text-xs text-gray-400 mt-1">優化後</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-shopee-orange">
                        +{latestLog.insights.score_after - latestLog.insights.score_before}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">提升</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 標題對比 */}
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">標題優化</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">原始標題</p>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{latestLog.original_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-500 mb-1">優化後標題</p>
                    <p className="text-sm text-gray-900 bg-green-50 rounded-lg p-3 font-medium">{latestLog.optimized_name}</p>
                  </div>
                </div>
              </div>

              {/* 關鍵字建議 */}
              {latestLog.insights?.keyword_suggestions && latestLog.insights.keyword_suggestions.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold text-gray-900 mb-3">建議關鍵字</h3>
                  <div className="flex flex-wrap gap-2">
                    {latestLog.insights.keyword_suggestions.map(kw => (
                      <span key={kw} className="bg-shopee-orange/10 text-shopee-orange-dark text-xs px-3 py-1 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 優缺點 */}
              {latestLog.insights && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="card">
                    <h3 className="text-sm font-semibold text-green-600 mb-2">優勢</h3>
                    <ul className="space-y-1">
                      {latestLog.insights.strengths.map(s => (
                        <li key={s} className="text-xs text-gray-600 flex items-start gap-1">
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-semibold text-red-500 mb-2">待改善</h3>
                    <ul className="space-y-1">
                      {latestLog.insights.weaknesses.map(w => (
                        <li key={w} className="text-xs text-gray-600 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* 描述對比 */}
              {latestLog.optimized_description && (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">描述優化</h3>
                    <button onClick={() => setExpandDesc(!expandDesc)} className="text-xs text-gray-400 flex items-center gap-1">
                      {expandDesc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {expandDesc ? '收起' : '展開'}
                    </button>
                  </div>
                  {expandDesc && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">原始描述</p>
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-auto">
                          {latestLog.original_description || '(無描述)'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-green-500 mb-1">優化後描述</p>
                        <p className="text-xs text-gray-900 bg-green-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-auto">
                          {latestLog.optimized_description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-12">
              <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">尚未進行 AI 優化分析</p>
              <button onClick={handleAnalyze} className="btn-primary mt-4 text-sm">立即開始分析</button>
            </div>
          )}
        </div>
      </div>

      {/* 競品列表 */}
      {competitors.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">競品數據（共 {competitors.length} 筆）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 pr-4">商品名稱</th>
                  <th className="pb-2 pr-4">售價</th>
                  <th className="pb-2 pr-4">銷量</th>
                  <th className="pb-2">評分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {competitors.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      <a href={c.shopee_url} target="_blank" rel="noopener noreferrer"
                        className="line-clamp-1 text-gray-700 hover:text-shopee-orange">
                        {c.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-shopee-orange font-medium">
                      {c.price ? `NT$ ${c.price.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{c.sold.toLocaleString()}</td>
                    <td className="py-2 text-gray-600">{c.rating ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
