import { Server, createRouteHandler } from 'vafast'
import { rateLimit } from '../src/index'

describe('Vafast Rate Limit Plugin', () => {
  it('should create rate limit middleware', () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 5,
      errorResponse: 'Rate limit exceeded',
      headers: true
    })
    
    expect(rateLimitMiddleware).toBeDefined()
    expect(typeof rateLimitMiddleware).toBe('function')
  })

  it('should allow requests within rate limit', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 3,
      headers: true
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
          return 'Hello, Rate Limited!'
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // 前3个请求应该成功
    for (let i = 0; i < 3; i++) {
      const res = await wrappedFetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      const data = await res.text()
      expect(data).toBe('Hello, Rate Limited!')
      
      // 检查速率限制头部
      expect(res.headers.get('RateLimit-Limit')).toBe('3')
      expect(res.headers.get('RateLimit-Remaining')).toBe(String(2 - i))
      expect(res.headers.get('RateLimit-Reset')).toBeDefined()
    }
  })

  it('should block requests when rate limit exceeded', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 2,
      errorResponse: 'Too many requests',
      headers: true
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
          return 'Hello, Rate Limited!'
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // 前2个请求应该成功
    for (let i = 0; i < 2; i++) {
      const res = await wrappedFetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
    }

    // 第3个请求应该被阻止
    const blockedRes = await wrappedFetch(new Request('http://localhost/'))
    expect(blockedRes.status).toBe(429)
    const errorData = await blockedRes.text()
    expect(errorData).toBe('Too many requests')
    
    // 检查错误响应头部
    expect(blockedRes.headers.get('RateLimit-Limit')).toBe('2')
    expect(blockedRes.headers.get('RateLimit-Remaining')).toBe('0')
    expect(blockedRes.headers.get('Retry-After')).toBeDefined()
  })

  it('should skip rate limiting when skip function returns true', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 1,
      headers: true,
      skip: (req) => req.url.includes('/health')
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
          return 'Hello, Rate Limited!'
        })
      },
      {
        method: 'GET',
        path: '/health',
        handler: createRouteHandler(() => {
          return { status: 'OK' }
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // 健康检查请求应该被跳过，不应用速率限制
    const healthRes = await wrappedFetch(new Request('http://localhost/health'))
    expect(healthRes.status).toBe(200)
    const healthData = await healthRes.json()
    expect(healthData.status).toBe('OK')
    
    // 健康检查响应不应该有速率限制头部
    expect(healthRes.headers.get('RateLimit-Limit')).toBeNull()
    expect(healthRes.headers.get('RateLimit-Remaining')).toBeNull()
  })

  it('should work with custom key generator', async () => {
    const customKeyGenerator = async (req: Request) => {
      const userAgent = req.headers.get('user-agent') || 'unknown'
      return `ua:${userAgent}`
    }

    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 2,
      generator: customKeyGenerator,
      headers: true
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
          return 'Hello, Custom Key!'
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // 使用不同的 User-Agent 应该有不同的速率限制
    const req1 = new Request('http://localhost/', {
      headers: { 'User-Agent': 'browser1' }
    })
    const req2 = new Request('http://localhost/', {
      headers: { 'User-Agent': 'browser2' }
    })

    // 两个不同的 User-Agent 都应该能成功请求
    const res1 = await wrappedFetch(req1)
    const res2 = await wrappedFetch(req2)
    
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })

  it('should handle failed requests correctly', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 3,
      countFailedRequest: false, // 不计算失败的请求
      headers: true
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/error',
        handler: createRouteHandler(() => {
          throw new Error('Simulated error')
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // 测试错误处理 - 由于 countFailedRequest: false，失败的请求不会影响速率限制
    const result = await wrappedFetch(new Request('http://localhost/error'))
    // 如果中间件正确处理了错误，我们应该得到一个响应而不是抛出异常
    expect(result).toBeDefined()
  })

  it('should work with different HTTP methods', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 2,
      headers: true
    })
    
    const app = new Server([
      {
        method: 'GET',
        path: '/',
        handler: createRouteHandler(() => {
          return { method: 'GET' }
        })
      },
      {
        method: 'POST',
        path: '/',
        handler: createRouteHandler(() => {
          return { method: 'POST' }
        })
      }
    ])

    // 应用中间件
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    // GET 请求
    const getRes = await wrappedFetch(new Request('http://localhost/'))
    expect(getRes.status).toBe(200)
    const getData = await getRes.json()
    expect(getData.method).toBe('GET')

    // POST 请求
    const postRes = await wrappedFetch(new Request('http://localhost/', { method: 'POST' }))
    expect(postRes.status).toBe(200)
    const postData = await postRes.json()
    expect(postData.method).toBe('POST')
  })
})
