import { Server, createRouteHandler } from 'vafast'
import { rateLimit } from '../src'

import type { Generator } from '../src'

// 自定义密钥生成器，基于 IP 地址
const keyGenerator: Generator<{ ip: string }> = async (req, server, { ip }) => {
  // 从请求头获取 IP
  const clientIp = req.headers.get('x-real-ip') || 
                   req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   'unknown'
  
  // 使用 IP 地址生成哈希作为密钥
  return Bun.hash(JSON.stringify(clientIp)).toString()
}

// 创建第一个实例的速率限制中间件
const aInstanceRateLimit = rateLimit({
  scoping: 'scoped',
  duration: 200 * 1000, // 200秒
  max: 10,
  generator: keyGenerator,
  errorResponse: 'Instance A rate limit exceeded',
  headers: true
})

// 创建第二个实例的速率限制中间件
const bInstanceRateLimit = rateLimit({
  scoping: 'scoped',
  duration: 100 * 1000, // 100秒
  max: 5,
  generator: keyGenerator,
  errorResponse: 'Instance B rate limit exceeded',
  headers: true
})

// 定义第一个实例的路由
const aInstanceRoutes = [
  {
    method: 'GET',
    path: '/a',
    handler: createRouteHandler(() => {
      return 'Instance A - Rate limited to 10 requests per 200 seconds'
    })
  }
]

// 定义第二个实例的路由
const bInstanceRoutes = [
  {
    method: 'GET',
    path: '/b',
    handler: createRouteHandler(() => {
      return 'Instance B - Rate limited to 5 requests per 100 seconds'
    })
  }
]

// 定义主应用路由
const mainRoutes = [
  {
    method: 'GET',
    path: '/',
    handler: createRouteHandler(() => {
      return 'Main application - No rate limiting'
    })
  },
  {
    method: 'GET',
    path: '/status',
    handler: createRouteHandler(() => {
      return { 
        message: 'Application status',
        instances: ['A', 'B'],
        timestamp: new Date().toISOString()
      }
    })
  }
]

// 创建实例服务器
const aInstance = new Server(aInstanceRoutes)
const bInstance = new Server(bInstanceRoutes)
const mainServer = new Server(mainRoutes)

// 导出 fetch 函数，应用不同的速率限制中间件
export default {
  fetch: (req: Request) => {
    const url = new URL(req.url)
    const path = url.pathname

    // 根据路径应用不同的速率限制中间件
    if (path.startsWith('/a')) {
      return aInstanceRateLimit(req, () => aInstance.fetch(req))
    } else if (path.startsWith('/b')) {
      return bInstanceRateLimit(req, () => bInstance.fetch(req))
    } else {
      // 主应用不应用速率限制
      return mainServer.fetch(req)
    }
  }
}
