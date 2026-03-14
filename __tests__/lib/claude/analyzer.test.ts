import type { Product, Competitor } from '@/types'

// Mock factory 在 jest.mock 中建立 mockCreate，這樣模組載入時就能捕捉到正確的 mock
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn()
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
  // 將 mockCreate 掛在 constructor 上，方便測試中取得
  ;(MockAnthropic as unknown as Record<string, unknown>)._mockCreate = mockCreate
  return { __esModule: true, default: MockAnthropic }
})

// 取得 mockCreate 的參考（必須在 jest.mock 之後）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MockAnthropic = require('@anthropic-ai/sdk').default
const mockCreate: jest.Mock = MockAnthropic._mockCreate

const mockProduct: Product = {
  id: 'prod-1',
  user_id: 'user-1',
  shopee_item_id: 789012,
  shopee_shop_id: 123456,
  shopee_url: 'https://shopee.tw/test-i.123456.789012',
  name: '藍牙耳機',
  description: '高音質藍牙耳機，支援 ANC',
  price: 1200,
  stock: 50,
  sold: 300,
  category: '3C',
  image_url: null,
  images: [],
  status: 'active',
  last_scraped_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockCompetitors: Competitor[] = [
  {
    id: 'comp-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    shopee_item_id: 111,
    shopee_shop_id: 222,
    shopee_url: 'https://shopee.tw/comp-i.222.111',
    name: '競品藍牙耳機 ANC降噪',
    description: null,
    price: 990,
    sold: 500,
    rating: 4.8,
    rating_count: 200,
    image_url: null,
    shop_name: '競品商店',
    tags: [],
    raw_data: {},
    scraped_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
  },
]

const mockInsights = {
  competitor_count: 1,
  avg_competitor_price: 990,
  price_position: 'above_average' as const,
  keyword_suggestions: ['台灣現貨', 'ANC降噪', '快速出貨'],
  strengths: ['音質優良'],
  weaknesses: ['標題缺乏關鍵字'],
  score_before: 55,
  score_after: 78,
}

const mockApiResponse = {
  optimized_name: '藍牙耳機 ANC主動降噪 台灣現貨快速出貨',
  optimized_description: '【台灣現貨】高音質藍牙耳機\n✅ ANC主動降噪\n✅ 快速出貨',
  suggested_price: 1099,
  insights: mockInsights,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(mockApiResponse) }],
    usage: { input_tokens: 500, output_tokens: 300 },
  })
})

// 延遲 import 確保 mock 已設定好
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { analyzeProduct } = require('@/lib/claude/analyzer')

describe('analyzeProduct', () => {
  it('應回傳正確格式的分析結果', async () => {
    const result = await analyzeProduct(mockProduct, mockCompetitors)

    expect(result.optimized_name).toBe(mockApiResponse.optimized_name)
    expect(result.optimized_description).toBe(mockApiResponse.optimized_description)
    expect(result.suggested_price).toBe(1099)
    expect(result.insights.score_before).toBe(55)
    expect(result.insights.score_after).toBe(78)
    expect(result.prompt_tokens).toBe(500)
    expect(result.completion_tokens).toBe(300)
  })

  it('應正確傳遞 model 與 max_tokens', async () => {
    await analyzeProduct(mockProduct, mockCompetitors)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
      })
    )
  })

  it('應清理 Claude 回傳的 markdown code block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(mockApiResponse)}\n\`\`\`` }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const result = await analyzeProduct(mockProduct, mockCompetitors)
    expect(result.optimized_name).toBe(mockApiResponse.optimized_name)
  })

  it('Claude 回傳無效 JSON 時應拋出錯誤', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '非 JSON 回應' }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    await expect(analyzeProduct(mockProduct, mockCompetitors)).rejects.toThrow('Claude 回傳格式錯誤')
  })

  it('無競品資料時應仍能正常運作', async () => {
    const result = await analyzeProduct(mockProduct, [])
    expect(result).toBeDefined()
    expect(result.optimized_name).toBeTruthy()
  })
})
