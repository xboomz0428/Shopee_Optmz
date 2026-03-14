import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // Claude API 分析最長 1 分鐘
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { analyzeProduct } from '@/lib/gemini/analyzer'
import type { AnalyzeRequest, OptimizationStreamEvent } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 })
  }

  const body: AnalyzeRequest = await req.json()
  const { product_id, competitor_ids } = body

  if (!product_id) {
    return NextResponse.json({ error: '缺少 product_id' }, { status: 400 })
  }

  // 取得商品資料
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .eq('user_id', user.id)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: '商品不存在' }, { status: 404 })
  }

  // 取得競品資料
  let competitorQuery = supabase
    .from('competitors')
    .select('*')
    .eq('product_id', product_id)
    .order('sold', { ascending: false })
    .limit(10)

  if (competitor_ids && competitor_ids.length > 0) {
    competitorQuery = supabase
      .from('competitors')
      .select('*')
      .in('id', competitor_ids)
  }

  const { data: competitors } = await competitorQuery

  // 建立 optimization_log (status=analyzing)
  const { data: log, error: logError } = await supabase
    .from('optimization_logs')
    .insert({
      user_id: user.id,
      product_id,
      original_name: product.name,
      original_description: product.description,
      original_price: product.price,
      status: 'analyzing',
    })
    .select()
    .single()

  if (logError || !log) {
    return NextResponse.json({ error: '建立優化紀錄失敗' }, { status: 500 })
  }

  // SSE 串流回應
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: OptimizationStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        send({ type: 'status', message: '正在準備商品資料...' })
        send({ type: 'progress', step: 1, total: 4 })

        await new Promise(r => setTimeout(r, 300))
        send({ type: 'status', message: `分析 ${(competitors || []).length} 筆競品數據...` })
        send({ type: 'progress', step: 2, total: 4 })

        await new Promise(r => setTimeout(r, 300))
        send({ type: 'status', message: '呼叫 Claude AI 進行文案優化...' })
        send({ type: 'progress', step: 3, total: 4 })

        const result = await analyzeProduct(product, competitors || [])

        send({ type: 'progress', step: 4, total: 4 })

        // 更新 optimization_log
        const { data: updatedLog } = await supabase
          .from('optimization_logs')
          .update({
            optimized_name: result.optimized_name,
            optimized_description: result.optimized_description,
            suggested_price: result.suggested_price,
            insights: result.insights,
            status: 'completed',
            ai_raw_response: result.raw_response,
            prompt_tokens: result.prompt_tokens,
            completion_tokens: result.completion_tokens,
          })
          .eq('id', log.id)
          .select()
          .single()

        send({ type: 'result', log: updatedLog! })
        send({ type: 'status', message: '分析完成！' })

      } catch (err) {
        // 標記為錯誤
        await supabase.from('optimization_logs')
          .update({ status: 'error', error_message: err instanceof Error ? err.message : '未知錯誤' })
          .eq('id', log.id)

        send({ type: 'error', message: err instanceof Error ? err.message : '分析過程發生錯誤' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  })
}
