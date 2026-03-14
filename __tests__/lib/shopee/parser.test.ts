import { validateShopeeUrl, extractShopeeIds, parseShopeeProduct } from '@/lib/shopee/parser'

describe('validateShopeeUrl', () => {
  it('應接受標準 i.shopId.itemId 格式', () => {
    expect(validateShopeeUrl('https://shopee.tw/product-name-i.123456.789012')).toBe(true)
  })

  it('應接受 /product/ 格式', () => {
    expect(validateShopeeUrl('https://shopee.tw/product/123456/789012')).toBe(true)
  })

  it('應拒絕非蝦皮網址', () => {
    expect(validateShopeeUrl('https://shopee.com/product-i.1.2')).toBe(false)
    expect(validateShopeeUrl('https://example.com')).toBe(false)
    expect(validateShopeeUrl('')).toBe(false)
  })

  it('應拒絕缺少 ID 的蝦皮網址', () => {
    expect(validateShopeeUrl('https://shopee.tw/product-name')).toBe(false)
  })
})

describe('extractShopeeIds', () => {
  it('應從 i.shopId.itemId 格式正確解析', () => {
    const result = extractShopeeIds('https://shopee.tw/product-name-i.123456.789012')
    expect(result).toEqual({ shopId: 123456, itemId: 789012 })
  })

  it('不含 ID 時應回傳 null', () => {
    const result = extractShopeeIds('https://shopee.tw/search?keyword=test')
    expect(result).toEqual({ shopId: null, itemId: null })
  })
})

describe('parseShopeeProduct', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('應從 __NEXT_DATA__ 解析商品資料', () => {
    const mockItem = {
      itemid: 789012,
      shopid: 123456,
      name: '測試商品',
      description: '商品描述',
      price: 29900000,
      stock: 50,
      historical_sold: 100,
      categories: [{ display_name: '電子產品' }],
      image: 'abc123',
      images: ['abc123', 'def456'],
    }
    document.body.innerHTML = `
      <script id="__NEXT_DATA__" type="application/json">
        ${JSON.stringify({
          props: { pageProps: { initialState: { itemDetail: { item: mockItem } } } }
        })}
      </script>
    `
    const result = parseShopeeProduct()
    expect(result.shopee_item_id).toBe(789012)
    expect(result.shopee_shop_id).toBe(123456)
    expect(result.name).toBe('測試商品')
    expect(result.price).toBe(299) // 29900000 / 100000 = 299 TWD
    expect(result.stock).toBe(50)
    expect(result.sold).toBe(100)
    expect(result.category).toBe('電子產品')
    expect(result.image_url).toBe('https://cf.shopee.tw/file/abc123')
    expect(result.images).toHaveLength(2)
  })

  it('__NEXT_DATA__ 無效時應 fallback 至 DOM 解析', () => {
    document.body.innerHTML = `
      <h1>備用商品標題</h1>
    `
    const result = parseShopeeProduct()
    expect(result.shopee_item_id).toBeNull()
    expect(result.name).toBe('備用商品標題')
  })

  it('__NEXT_DATA__ JSON 損壞時應安全 fallback', () => {
    document.body.innerHTML = `
      <script id="__NEXT_DATA__" type="application/json">invalid json{{{</script>
      <h1>備用標題</h1>
    `
    expect(() => parseShopeeProduct()).not.toThrow()
    const result = parseShopeeProduct()
    expect(result.name).toBe('備用標題')
  })
})
