'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Product } from '@/types'
import { Search, Plus, Zap, Eye, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface ProductWithLogs extends Product {
  optimization_logs: Array<{ id: string; status: string; insights: unknown; created_at: string }>
}

export default function ProductsClient({ initialProducts }: { initialProducts: ProductWithLogs[] }) {
  const [search, setSearch] = useState('')
  const [products] = useState(initialProducts)
  const router = useRouter()

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const getLatestScore = (logs: ProductWithLogs['optimization_logs']) => {
    const completed = logs.filter(l => l.status === 'applied' || l.status === 'completed')
    if (completed.length === 0) return null
    const latest = completed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    const ins = latest.insights as { score_after?: number } | null
    return ins?.score_after ?? null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
          <p className="text-gray-500 text-sm mt-1">共 {products.length} 筆商品</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> 新增商品
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-10"
          placeholder="搜尋商品名稱..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">尚無商品，請從儀表板輸入蝦皮網址開始分析</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(product => {
            const score = getLatestScore(product.optimization_logs)
            return (
              <div key={product.id} className="card hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => router.push(`/products/${product.id}`)}>
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name}
                        width={64} height={64} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                    <p className="text-shopee-orange font-semibold text-sm mt-1">
                      {product.price ? `NT$ ${product.price.toLocaleString()}` : '未定價'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {score !== null && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          優化分 {score}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(product.created_at), { addSuffix: true, locale: zhTW })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"
                    onClick={e => { e.stopPropagation(); router.push(`/products/${product.id}`) }}>
                    <Eye className="w-3 h-3" /> 詳情
                  </button>
                  <button className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1"
                    onClick={e => { e.stopPropagation(); router.push(`/products/${product.id}?action=analyze`) }}>
                    <Zap className="w-3 h-3" /> 優化
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
