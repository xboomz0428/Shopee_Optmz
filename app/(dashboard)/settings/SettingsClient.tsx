'use client'
import { useState } from 'react'
import type { ShopeeSession, ShopeeCookie } from '@/types'
import { Upload, Trash2, Check, AlertCircle, Shield, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export default function SettingsClient({ sessions }: { sessions: Partial<ShopeeSession>[] }) {
  const [sessionList, setSessionList] = useState(sessions)
  const [label, setLabel] = useState('')
  const [cookieJson, setCookieJson] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [jsonError, setJsonError] = useState('')

  function validateCookieJson(value: string) {
    setCookieJson(value)
    if (!value.trim()) { setJsonError(''); return }
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) { setJsonError('必須是陣列格式 [...]'); return }
      const required = ['name', 'value', 'domain']
      const missing = parsed.find((c: Record<string, unknown>) => required.some(k => !c[k]))
      if (missing) { setJsonError('每個 cookie 必須包含 name, value, domain 欄位'); return }
      setJsonError('')
    } catch {
      setJsonError('JSON 格式錯誤，請確認格式正確')
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (jsonError) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const cookies: ShopeeCookie[] = JSON.parse(cookieJson)
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, cookies, set_active: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSessionList(prev => [data.session, ...prev.map(s => ({ ...s, is_active: false }))])
      setSuccess(`成功上傳 ${data.cookie_count} 個 Cookie`)
      setLabel('')
      setCookieJson('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/session/${id}`, { method: 'DELETE' })
    if (res.ok) setSessionList(prev => prev.filter(s => s.id !== id))
  }

  const isExpired = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isExpiringSoon = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return false
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    return new Date(expiresAt) < threeDaysLater
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-gray-500 text-sm mt-1">管理蝦皮登入 Cookie Session</p>
      </div>

      {/* 上傳 Session */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-shopee-orange" />
          <h2 className="text-lg font-semibold text-gray-900">上傳新的 Cookie Session</h2>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-700">
          <strong>如何取得 Cookie？</strong> 在瀏覽器安裝 EditThisCookie 或 Cookie-Editor 擴充功能，
          登入蝦皮後匯出所有 Cookie 為 JSON 格式，再貼入下方欄位。
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session 名稱</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              className="input" placeholder="例如：主帳號 Cookie" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cookie JSON</label>
            <textarea value={cookieJson} onChange={e => validateCookieJson(e.target.value)}
              className={`input h-32 resize-none font-mono text-xs ${jsonError ? 'border-red-400 focus:border-red-400' : ''}`}
              placeholder='[{"name": "SPC_ST", "value": "...", "domain": ".shopee.tw", ...}]'
              required />
            {jsonError && <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{jsonError}
            </p>}
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />{error}
          </p>}
          {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-1">
            <Check className="w-4 h-4" />{success}
          </p>}

          <button type="submit" className="btn-primary flex items-center gap-2" disabled={uploading || !!jsonError}>
            <Upload className="w-4 h-4" />{uploading ? '上傳中...' : '上傳並設為使用中'}
          </button>
        </form>
      </div>

      {/* Session 列表 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-shopee-orange" />
          <h2 className="text-lg font-semibold text-gray-900">已儲存的 Sessions</h2>
        </div>
        {sessionList.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">尚未上傳任何 Session</p>
        ) : (
          <div className="space-y-3">
            {sessionList.map(session => (
              <div key={session.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                session.is_active ? 'border-shopee-orange/40 bg-orange-50' : 'border-gray-100 bg-gray-50'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{session.label}</span>
                    {session.is_active && (
                      <span className="text-xs bg-shopee-orange text-white px-2 py-0.5 rounded-full">使用中</span>
                    )}
                    {isExpired(session.expires_at) && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">已過期</span>
                    )}
                    {!isExpired(session.expires_at) && isExpiringSoon(session.expires_at) && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">即將過期</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {session.expires_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        過期：{format(new Date(session.expires_at), 'MM/dd HH:mm')}
                      </span>
                    )}
                    {session.last_used_at && (
                      <span>最後使用：{formatDistanceToNow(new Date(session.last_used_at), { addSuffix: true, locale: zhTW })}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(session.id!)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
