/**
 * 简单的日志工具
 * 替代 debug 包，避免 ESM 兼容性问题
 */

// 检查是否启用调试模式
const DEBUG = process.env.DEBUG?.includes('vafast-rate-limit') || false

export const logger = (unit: string, formatter: string, ...params: unknown[]) => {
  if (!DEBUG) return
  
  const key = `@vafast/rate-limit:${unit}`
  const message = params.reduce<string>(
    (msg, param) => msg.replace('%s', String(param)).replace('%d', String(param)),
    formatter
  )
  
  console.log(`[${key}] ${message}`)
}
