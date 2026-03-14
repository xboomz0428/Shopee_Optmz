import Anthropic from '@anthropic-ai/sdk'
import type { Product, Competitor, OptimizationInsights } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `你是台灣蝦皮電商優化顧問，專精於提升商品曝光率與轉換率。
分析時請考慮：台灣消費者搜尋習慣（中文關鍵字優先）、蝦皮演算法偏好關鍵字密度與完整度、競品定價策略、以及台灣電商文案風格。

標題優化原則：
1. 前60字元最重要（蝦皮截斷顯示）
2. 必須包含：品牌詞 + 功能詞 + 情境詞/受眾詞
3. 加入熱門搜尋關鍵字但避免堆砌
4. 標題不超過60字元

描述優化原則：
1. 開頭3行最重要（摺疊前顯示）
2. 條列式說明規格優於長段文字
3. 加入常見 FAQ 提升SEO
4. 強調台灣現貨、快速出貨等信任信號

違禁詞過濾：不得包含「最」「第一」「最佳」等最高級形容詞（公平交易法限制）。
請用繁體中文回應，輸出必須為純 JSON，不含 markdown code block。`

function buildPrompt(product: Product, competitors: Competitor[]): string {
  const avgPrice = competitors.length > 0
    ? competitors.reduce((sum, c) => sum + (c.price || 0), 0) / competitors.length
    : product.price || 0

  return `【待優化商品】
名稱：${product.name}
描述：${product.description?.slice(0, 500) ?? '(無描述)'}
售價：NT$ ${product.price ?? '未知'}
銷量：${product.sold}
分類：${product.category ?? '未分類'}

【競品分析（共 ${competitors.length} 筆）】
競品平均售價：NT$ ${avgPrice.toFixed(0)}
${competitors
  .slice(0, 10)
  .map((c, i) => `${i + 1}. ${c.name} | NT$${c.price} | 銷量${c.sold} | 評分${c.rating ?? 'N/A'}`)
  .join('\n')}

請根據以上資料，回傳以下 JSON 格式（純 JSON，不要有 markdown）：
{
  "optimized_name": "優化後標題（不超過60字元）",
  "optimized_description": "優化後描述（不超過2000字元，使用\\n換行）",
  "suggested_price": 299,
  "insights": {
    "competitor_count": ${competitors.length},
    "avg_competitor_price": ${avgPrice.toFixed(2)},
    "price_position": "above_average",
    "keyword_suggestions": ["台灣現貨", "快速出貨", "免運費"],
    "strengths": ["說明完整", "圖片清晰"],
    "weaknesses": ["標題缺乏關鍵字", "價格偏高"],
    "score_before": 60,
    "score_after": 82
  }
}`
}

export interface AnalysisResult {
  optimized_name: string
  optimized_description: string
  suggested_price: number
  insights: OptimizationInsights
  raw_response: string
  prompt_tokens: number
  completion_tokens: number
}

export async function analyzeProduct(
  product: Product,
  competitors: Competitor[]
): Promise<AnalysisResult> {
  const prompt = buildPrompt(product, competitors)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('')

  // 清理 markdown code block（若 Claude 仍包含）
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed: {
    optimized_name?: string
    optimized_description?: string
    suggested_price?: number
    insights?: OptimizationInsights
  }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Claude 回傳格式錯誤：${cleaned.slice(0, 200)}`)
  }

  return {
    optimized_name: parsed.optimized_name || product.name,
    optimized_description: parsed.optimized_description || product.description || '',
    suggested_price: parsed.suggested_price || product.price || 0,
    insights: parsed.insights || {
      competitor_count: competitors.length,
      avg_competitor_price: 0,
      price_position: 'average',
      keyword_suggestions: [],
      strengths: [],
      weaknesses: [],
      score_before: 50,
      score_after: 70,
    },
    raw_response: rawText,
    prompt_tokens: response.usage.input_tokens,
    completion_tokens: response.usage.output_tokens,
  }
}

export async function* analyzeProductStream(
  product: Product,
  competitors: Competitor[]
): AsyncGenerator<string> {
  const prompt = buildPrompt(product, competitors)

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}
