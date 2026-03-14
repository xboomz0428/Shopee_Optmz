// ============================================================
// 狀態型別
// ============================================================
export type ProductStatus = 'active' | 'inactive' | 'scraping' | 'error'
export type OptimizationStatus = 'pending' | 'analyzing' | 'completed' | 'applied' | 'error'

// ============================================================
// 資料庫 Row 型別
// ============================================================
export interface Product {
  id: string
  user_id: string
  shopee_item_id: number | null
  shopee_shop_id: number | null
  shopee_url: string | null
  name: string
  description: string | null
  price: number | null
  stock: number
  sold: number
  category: string | null
  image_url: string | null
  images: string[]
  status: ProductStatus
  last_scraped_at: string | null
  created_at: string
  updated_at: string
}

export interface Competitor {
  id: string
  user_id: string
  product_id: string | null
  shopee_item_id: number
  shopee_shop_id: number
  shopee_url: string
  name: string
  description: string | null
  price: number | null
  sold: number
  rating: number | null
  rating_count: number
  image_url: string | null
  shop_name: string | null
  tags: string[]
  raw_data: Record<string, unknown>
  scraped_at: string
  created_at: string
}

export interface OptimizationInsights {
  competitor_count: number
  avg_competitor_price: number
  price_position: 'below_average' | 'average' | 'above_average'
  keyword_suggestions: string[]
  strengths: string[]
  weaknesses: string[]
  score_before: number
  score_after: number
}

export interface OptimizationLog {
  id: string
  user_id: string
  product_id: string
  original_name: string
  original_description: string | null
  original_price: number | null
  optimized_name: string | null
  optimized_description: string | null
  suggested_price: number | null
  insights: OptimizationInsights | null
  status: OptimizationStatus
  error_message: string | null
  claude_raw_response: string | null
  claude_model: string
  prompt_tokens: number | null
  completion_tokens: number | null
  applied_at: string | null
  created_at: string
  updated_at: string
}

export interface ShopeeSession {
  id: string
  user_id: string
  label: string
  cookies: ShopeeCookie[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface ShopeeCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'None' | 'Lax' | 'Strict'
}

// ============================================================
// API Request / Response 型別
// ============================================================
export interface ScrapeRequest {
  shopee_url: string
  product_id?: string
  include_competitors?: boolean
  competitor_keyword?: string
}

export interface ScrapeResponse {
  product: Product
  competitors?: Competitor[]
  session_used: string
  scraped_at: string
}

export interface AnalyzeRequest {
  product_id: string
  competitor_ids?: string[]
  stream?: boolean
}

export type OptimizationStreamEvent =
  | { type: 'status';   message: string }
  | { type: 'progress'; step: number; total: number }
  | { type: 'result';   log: OptimizationLog }
  | { type: 'error';    message: string }

export interface ProductsListResponse {
  products: Product[]
  total: number
}

export interface CreateProductRequest {
  name: string
  description?: string
  price?: number
  shopee_url?: string
  category?: string
}

export interface UploadSessionRequest {
  label: string
  cookies: ShopeeCookie[]
  set_active?: boolean
}

export interface UploadSessionResponse {
  session: ShopeeSession
  expires_at: string | null
  cookie_count: number
}

export interface DashboardStats {
  total_products: number
  optimized_products: number
  avg_score_improvement: number
  recent_logs: OptimizationLog[]
}
