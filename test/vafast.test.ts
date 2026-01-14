import { Server, defineRoute, defineRoutes, json } from 'vafast'
import { rateLimit } from '../src/index'
import { describe, it, expect, beforeEach } from 'vitest'

describe('Vafast Rate Limit Plugin', () => {
  // ========== 基础功能测试 ==========
  
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
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/',
          handler: () => 'Hello, Rate Limited!'
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    for (let i = 0; i < 3; i++) {
      const res = await wrappedFetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
      const data = await res.text()
      expect(data).toBe('Hello, Rate Limited!')
      
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
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/',
          handler: () => 'Hello, Rate Limited!'
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    for (let i = 0; i < 2; i++) {
      const res = await wrappedFetch(new Request('http://localhost/'))
      expect(res.status).toBe(200)
    }

    const blockedRes = await wrappedFetch(new Request('http://localhost/'))
    expect(blockedRes.status).toBe(429)
    const errorData = await blockedRes.text()
    expect(errorData).toBe('Too many requests')
    
    expect(blockedRes.headers.get('RateLimit-Limit')).toBe('2')
    expect(blockedRes.headers.get('RateLimit-Remaining')).toBe('0')
    expect(blockedRes.headers.get('Retry-After')).toBeDefined()
  })

  // ========== skip 功能测试 ==========
  
  it('should skip rate limiting when skip function returns true', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 1,
      headers: true,
      skip: (req) => req.url.includes('/health')
    })
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/',
          handler: () => 'Hello, Rate Limited!'
        }),
        defineRoute({
          method: 'GET',
          path: '/health',
          handler: () => json({ status: 'OK' })
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    const healthRes = await wrappedFetch(new Request('http://localhost/health'))
    expect(healthRes.status).toBe(200)
    const healthData = await healthRes.json()
    expect(healthData.status).toBe('OK')
    
    expect(healthRes.headers.get('RateLimit-Limit')).toBeNull()
    expect(healthRes.headers.get('RateLimit-Remaining')).toBeNull()
  })

  it('should skip rate limiting with key parameter', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 1,
      headers: true,
      // skip 函数带 key 参数
      skip: (req, key) => {
        return key?.includes('admin') || false
      },
      generator: async (req) => {
        const authHeader = req.headers.get('authorization') || 'anonymous'
        return authHeader.includes('admin') ? 'admin-user' : 'normal-user'
      }
    })

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => new Response('OK'))
    }

    // Admin 用户应该被跳过
    const adminRes = await wrappedFetch(new Request('http://localhost/', {
      headers: { 'Authorization': 'Bearer admin-token' }
    }))
    expect(adminRes.status).toBe(200)
    expect(adminRes.headers.get('RateLimit-Limit')).toBeNull()
  })

  // ========== 自定义 keyGenerator 测试 ==========
  
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
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/',
          handler: () => 'Hello, Custom Key!'
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    const req1 = new Request('http://localhost/', {
      headers: { 'User-Agent': 'browser1' }
    })
    const req2 = new Request('http://localhost/', {
      headers: { 'User-Agent': 'browser2' }
    })

    const res1 = await wrappedFetch(req1)
    const res2 = await wrappedFetch(req2)
    
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })

  // ========== 错误处理测试 ==========
  
  it('should handle failed requests with countFailedRequest: false', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 3,
      countFailedRequest: false,
      headers: true
    })
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/error',
          handler: () => {
            throw new Error('Simulated error')
          }
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    const result = await wrappedFetch(new Request('http://localhost/error'))
    expect(result).toBeDefined()
  })

  // ========== HTTP 方法测试 ==========
  
  it('should work with different HTTP methods', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 2,
      headers: true
    })
    
    const app = new Server(
      defineRoutes([
        defineRoute({
          method: 'GET',
          path: '/',
          handler: () => json({ method: 'GET' })
        }),
        defineRoute({
          method: 'POST',
          path: '/',
          handler: () => json({ method: 'POST' })
        })
      ])
    )

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, () => app.fetch(req))
    }

    const getRes = await wrappedFetch(new Request('http://localhost/'))
    expect(getRes.status).toBe(200)
    const getData = await getRes.json()
    expect(getData.method).toBe('GET')

    const postRes = await wrappedFetch(new Request('http://localhost/', { method: 'POST' }))
    expect(postRes.status).toBe(200)
    const postData = await postRes.json()
    expect(postData.method).toBe('POST')
  })

  // ========== errorResponse 类型测试 ==========
  
  it('should handle errorResponse as Response object', async () => {
    const customErrorResponse = new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    })
    
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 1,
      errorResponse: customErrorResponse,
      headers: true
    })

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => new Response('OK'))
    }

    // 第一个请求通过
    await wrappedFetch(new Request('http://localhost/'))
    
    // 第二个请求被阻止
    const blockedRes = await wrappedFetch(new Request('http://localhost/'))
    expect(blockedRes.status).toBe(429)
    const data = await blockedRes.json()
    expect(data.error).toBe('Rate limited')
  })

  it('should handle errorResponse as Error object', async () => {
    const customError = new Error('Custom rate limit error')
    
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 1,
      errorResponse: customError,
      headers: true
    })

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => new Response('OK'))
    }

    // 第一个请求通过
    await wrappedFetch(new Request('http://localhost/'))
    
    // 第二个请求应该抛出错误
    await expect(wrappedFetch(new Request('http://localhost/'))).rejects.toThrow('Custom rate limit error')
  })

  // ========== headers 选项测试 ==========
  
  it('should not add headers when headers: false', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 3,
      headers: false
    })

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => new Response('OK'))
    }

    const res = await wrappedFetch(new Request('http://localhost/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('RateLimit-Limit')).toBeNull()
    expect(res.headers.get('RateLimit-Remaining')).toBeNull()
    expect(res.headers.get('RateLimit-Reset')).toBeNull()
  })

  // ========== 过期重置测试 ==========
  
  it('should reset count after duration expires', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 100, // 100ms
      max: 1,
      headers: true
    })

    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => new Response('OK'))
    }

    // 第一个请求通过
    const res1 = await wrappedFetch(new Request('http://localhost/'))
    expect(res1.status).toBe(200)
    
    // 第二个请求被阻止
    const res2 = await wrappedFetch(new Request('http://localhost/'))
    expect(res2.status).toBe(429)
    
    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // 第三个请求应该通过（计数已重置）
    const res3 = await wrappedFetch(new Request('http://localhost/'))
    expect(res3.status).toBe(200)
  })

  // ========== countFailedRequest: true 测试 ==========
  
  it('should count failed requests when countFailedRequest: true', async () => {
    const rateLimitMiddleware = rateLimit({
      duration: 60000,
      max: 2,
      countFailedRequest: true,
      headers: true
    })

    let requestCount = 0
    const wrappedFetch = (req: Request) => {
      return rateLimitMiddleware(req, async () => {
        requestCount++
        if (requestCount === 1) {
          throw new Error('First request failed')
        }
        return new Response('OK')
      })
    }

    // 第一个请求失败
    try {
      await wrappedFetch(new Request('http://localhost/'))
    } catch (e) {
      // 期望错误
    }
    
    // 第二个请求成功
    const res2 = await wrappedFetch(new Request('http://localhost/'))
    expect(res2.status).toBe(200)
    
    // 第三个请求被阻止（因为失败的请求也计入了）
    const res3 = await wrappedFetch(new Request('http://localhost/'))
    expect(res3.status).toBe(429)
  })
})
