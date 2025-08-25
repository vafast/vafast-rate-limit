import { Server, createRouteHandler } from 'vafast'
import { rateLimit } from '../src'

// 创建速率限制中间件
const rateLimitMiddleware = rateLimit({
  duration: 60000, // 1分钟
  max: 5, // 最多5个请求
  errorResponse: 'Rate limit exceeded. Please try again later.',
  headers: true,
  skip: (req) => {
    // 跳过健康检查请求
    return req.url.includes('/health')
  }
})

// 定义路由
const routes = [
  {
    method: 'GET',
    path: '/',
    handler: createRouteHandler(() => {
      return 'Hello, Vafast with Rate Limiting!'
    })
  },
  {
    method: 'GET',
    path: '/health',
    handler: createRouteHandler(() => {
      return { status: 'OK', timestamp: new Date().toISOString() }
    })
  },
  {
    method: 'POST',
    path: '/api/data',
    handler: createRouteHandler(() => {
      return { message: 'Data created successfully' }
    })
  }
]

// 创建服务器
const server = new Server(routes)

// 导出 fetch 函数，应用中间件
export default {
  fetch: (req: Request) => {
    // 应用速率限制中间件
    return rateLimitMiddleware(req, () => server.fetch(req))
  }
}
