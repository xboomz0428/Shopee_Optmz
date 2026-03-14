import type { ShopeeCookie } from '@/types'
import { parseShopeeProduct, extractShopeeIds, validateShopeeUrl } from '@/lib/shopee/parser'

export interface ScrapedProductData {
  shopee_item_id: number | null
  shopee_shop_id: number | null
  name: string
  description: string
  price: number | null
  stock: number
  sold: number
  category: string | null
  image_url: string | null
  images: string[]
}

export async function scrapeShopeePage(
  url: string,
  cookies: ShopeeCookie[]
): Promise<ScrapedProductData> {
  if (!validateShopeeUrl(url)) {
    throw new Error('無效的蝦皮商品網址格式')
  }

  // 動態 import 避免 SSR 問題
  const Browserbase = (await import('@browserbasehq/sdk')).default
  const { chromium } = await import('playwright-core')

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })

  // 建立 Browserbase session
  const bbSession = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: {
      viewport: { width: 1280, height: 900 },
    },
  })

  const browser = await chromium.connectOverCDP(bbSession.connectUrl)
  const context = browser.contexts()[0] || await browser.newContext()

  try {
    // 注入蝦皮登入 Cookies
    if (cookies.length > 0) {
      await context.addCookies(
        cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          expires: c.expires || -1,
          httpOnly: c.httpOnly ?? false,
          secure: c.secure ?? true,
          sameSite: (['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax') as 'None' | 'Lax' | 'Strict',
        }))
      )
    }

    const page = await context.newPage()

    // 設定台灣使用者 headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })

    // 等待商品名稱載入
    await page.waitForSelector('h1, [class*="product-briefing"]', {
      timeout: 15000,
    }).catch(() => null)

    // 執行 DOM 解析
    const rawData = await page.evaluate(parseShopeeProduct)

    // 若 parser 沒抓到 ID，從 URL 補充
    if (!rawData.shopee_item_id) {
      const { itemId, shopId } = extractShopeeIds(url)
      rawData.shopee_item_id = itemId
      rawData.shopee_shop_id = shopId
    }

    return rawData

  } finally {
    await browser.close()
  }
}

export async function scrapeShopeeSearch(
  keyword: string,
  cookies: ShopeeCookie[],
  limit = 10
): Promise<Array<{
  shopee_item_id: number
  shopee_shop_id: number
  shopee_url: string
  name: string
  price: number | null
  sold: number
  rating: number | null
  rating_count: number
  image_url: string | null
  shop_name: string | null
}>> {
  const Browserbase = (await import('@browserbasehq/sdk')).default
  const { chromium } = await import('playwright-core')

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
  const bbSession = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    browserSettings: { viewport: { width: 1280, height: 900 } },
  })

  const browser = await chromium.connectOverCDP(bbSession.connectUrl)
  const context = browser.contexts()[0] || await browser.newContext()

  try {
    if (cookies.length > 0) {
      await context.addCookies(cookies.map(c => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
        expires: c.expires || -1, httpOnly: c.httpOnly ?? false, secure: c.secure ?? true,
        sameSite: (['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax') as 'None' | 'Lax' | 'Strict',
      })))
    }

    const page = await context.newPage()
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9',
    })

    const searchUrl = `https://shopee.tw/search?keyword=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForSelector('[class*="shopee-search-item-result"]', { timeout: 10000 }).catch(() => null)

    // 擷取搜尋結果
    const items = await page.evaluate((lim: number) => {
      const cards = Array.from(document.querySelectorAll('[data-sqe="item"]')).slice(0, lim)
      return cards.map(card => {
        const link = card.querySelector('a')?.href || ''
        const match = link.match(/i\.(\d+)\.(\d+)/)
        const img = card.querySelector('img') as HTMLImageElement
        const priceEl = card.querySelector('[class*="price"]')
        const priceText = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0'

        return {
          shopee_item_id: match ? parseInt(match[2]) : 0,
          shopee_shop_id: match ? parseInt(match[1]) : 0,
          shopee_url: link,
          name: card.querySelector('[class*="name"]')?.textContent?.trim() || '',
          price: parseFloat(priceText) || null,
          sold: 0,
          rating: null,
          rating_count: 0,
          image_url: img?.src || null,
          shop_name: null,
        }
      })
    }, limit)

    return items.filter(item => item.shopee_item_id > 0)

  } finally {
    await browser.close()
  }
}
