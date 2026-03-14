// 此函式在 Browserbase page.evaluate() 中執行
export function parseShopeeProduct() {
  // 嘗試從 __NEXT_DATA__ 取得 SSR 商品資料
  const nextDataEl = document.getElementById('__NEXT_DATA__')
  if (nextDataEl) {
    try {
      const nextData = JSON.parse(nextDataEl.textContent || '{}')
      const props = nextData?.props?.pageProps
      if (props?.initialState?.itemDetail?.item) {
        const item = props.initialState.itemDetail.item
        return {
          shopee_item_id: item.itemid,
          shopee_shop_id: item.shopid,
          name: item.name || '',
          description: item.description || '',
          price: item.price ? item.price / 100000 : null,
          stock: item.stock || 0,
          sold: item.historical_sold || 0,
          category: item.categories?.[item.categories.length - 1]?.display_name || null,
          image_url: item.image
            ? `https://cf.shopee.tw/file/${item.image}`
            : null,
          images: (item.images || []).map(
            (img: string) => `https://cf.shopee.tw/file/${img}`
          ),
        }
      }
    } catch {
      // fallback to DOM parsing
    }
  }

  // DOM fallback
  const name = document.querySelector('[class*="product-briefing"] [class*="name"]')?.textContent?.trim()
    || document.querySelector('h1')?.textContent?.trim()
    || ''

  const priceEl = document.querySelector('[class*="price-current"] [class*="currency"]')
  const priceText = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0'

  return {
    shopee_item_id: null,
    shopee_shop_id: null,
    name,
    description: document.querySelector('[class*="product-description"]')?.textContent?.trim() || '',
    price: parseFloat(priceText) || null,
    stock: 0,
    sold: 0,
    category: null,
    image_url: (document.querySelector('[class*="product-image"] img') as HTMLImageElement)?.src || null,
    images: [],
  }
}

export function extractShopeeIds(url: string): { itemId: number | null; shopId: number | null } {
  // 格式: https://shopee.tw/xxxx-i.{shopId}.{itemId}
  const match = url.match(/i\.(\d+)\.(\d+)/)
  if (match) {
    return { shopId: parseInt(match[1]), itemId: parseInt(match[2]) }
  }
  return { shopId: null, itemId: null }
}

export function validateShopeeUrl(url: string): boolean {
  return /^https:\/\/shopee\.tw\/.+-i\.\d+\.\d+/.test(url)
    || /^https:\/\/shopee\.tw\/product\/\d+\/\d+/.test(url)
}
