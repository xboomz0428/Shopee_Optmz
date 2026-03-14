import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120 // Browserbase 爬取最長需要 2 分鐘
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { scrapeShopeePage, scrapeShopeeSearch } from '@/lib/browserbase/scraper'
import { validateShopeeUrl } from '@/lib/shopee/parser'
import type { ScrapeRequest } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const body: ScrapeRequest = await req.json()
    const { shopee_url, product_id, include_competitors, competitor_keyword } = body

    if (!shopee_url || !validateShopeeUrl(shopee_url)) {
      return NextResponse.json({ error: '無效的蝦皮商品網址' }, { status: 400 })
    }

    // 取得 active session cookies
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, label, cookies')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: '請先至設定頁面上傳蝦皮 Cookie Session' }, { status: 400 })
    }

    // 更新商品狀態為 scraping
    if (product_id) {
      await supabase.from('products').update({ status: 'scraping' }).eq('id', product_id)
    }

    // 執行爬取
    const scraped = await scrapeShopeePage(shopee_url, session.cookies)

    // Upsert products
    const productData = {
      user_id: user.id,
      shopee_item_id: scraped.shopee_item_id,
      shopee_shop_id: scraped.shopee_shop_id,
      shopee_url,
      name: scraped.name,
      description: scraped.description,
      price: scraped.price,
      stock: scraped.stock,
      sold: scraped.sold,
      category: scraped.category,
      image_url: scraped.image_url,
      images: scraped.images,
      status: 'active' as const,
      last_scraped_at: new Date().toISOString(),
    }

    let product
    if (product_id) {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', product_id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      product = data
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()
      if (error) throw error
      product = data
    }

    // 更新 session last_used_at
    await supabase.from('sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', session.id)

    // 選擇性爬取競品
    let competitors = []
    if (include_competitors && (competitor_keyword || scraped.name)) {
      const keyword = competitor_keyword || scraped.name.split(' ').slice(0, 3).join(' ')
      try {
        const searchResults = await scrapeShopeeSearch(keyword, session.cookies, 10)
        const competitorData = searchResults
          .filter(r => r.shopee_item_id !== scraped.shopee_item_id)
          .map(r => ({
            user_id: user.id,
            product_id: product.id,
            ...r,
          }))
        if (competitorData.length > 0) {
          const { data } = await supabase.from('competitors').insert(competitorData).select()
          competitors = data || []
        }
      } catch {
        // 競品爬取失敗不影響主流程
      }
    }

    return NextResponse.json({
      product,
      competitors,
      session_used: session.label,
      scraped_at: new Date().toISOString(),
    })

  } catch (err) {
    console.error('[scrape]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '爬取過程發生錯誤' },
      { status: 500 }
    )
  }
}
