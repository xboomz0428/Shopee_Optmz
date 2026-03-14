#!/usr/bin/env node
/**
 * AI 部署說明生成器
 * 呼叫 Claude API 根據 git 變更自動產生繁體中文部署說明
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getGitInfo() {
  const run = (cmd) => {
    try { return execSync(cmd, { encoding: 'utf8' }).trim() }
    catch { return '' }
  }

  return {
    branch:       run('git rev-parse --abbrev-ref HEAD'),
    commitHash:   run('git rev-parse --short HEAD'),
    commitMsg:    run('git log -1 --pretty=%B'),
    author:       run('git log -1 --pretty=%an'),
    changedFiles: run('git diff HEAD~1 --name-only 2>/dev/null || git show --name-only --pretty="" HEAD'),
    stats:        run('git diff HEAD~1 --stat 2>/dev/null || git show --stat --pretty="" HEAD | tail -1'),
  }
}

async function generateReleaseNotes(gitInfo, deployUrl) {
  const prompt = `你是一位技術文件工程師，請根據以下 git 資訊產生一份簡潔的繁體中文部署說明。

【部署資訊】
- 分支：${gitInfo.branch}
- Commit：${gitInfo.commitHash}
- 訊息：${gitInfo.commitMsg}
- 作者：${gitInfo.author}
- 異動檔案：
${gitInfo.changedFiles || '（無法取得）'}
- 統計：${gitInfo.stats || '（無法取得）'}
- 部署網址：${deployUrl || '（本機測試）'}
- 部署時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}

請產生以下格式的說明（純文字，不要 markdown）：

=== 部署說明 ===
版本：[根據 commit 推斷版本類型：功能更新/修復/重構/優化]
摘要：[一句話說明此次部署的主要目的]

變更重點：
- [列出 2-4 個主要變更，根據檔案名稱推斷功能]

影響範圍：
- [列出可能受影響的功能模組]

注意事項：
- [如有需要手動操作的步驟或風險提示]
===============`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

async function main() {
  const deployUrl = process.argv[2] || ''
  const outputFile = process.argv[3] || 'deploy-notes.txt'

  console.log('📝 正在使用 Claude AI 生成部署說明...')

  const gitInfo = getGitInfo()
  const notes = await generateReleaseNotes(gitInfo, deployUrl)

  // 輸出到終端
  console.log('\n' + notes)

  // 儲存到檔案
  mkdirSync('logs', { recursive: true })
  const logPath = `logs/${outputFile}`
  writeFileSync(logPath, notes, 'utf8')
  console.log(`\n✅ 部署說明已儲存至 ${logPath}`)
}

main().catch(err => {
  console.error('⚠️  生成部署說明失敗：', err.message)
  process.exit(0) // 不阻斷部署流程
})
