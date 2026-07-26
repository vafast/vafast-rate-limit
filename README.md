# @vafast/rate-limit

Vafast 请求频率限制中间件。按客户端 key 在时间窗口内限制请求次数；超限返回 **429**，并可写入 `RateLimit-*` / `Retry-After` 响应头。

完整文档：[Rate Limit](https://vafast.dev/middleware/rate-limit)

## 先搞清几个概念

- **限流 key**：由 `generator` 生成；默认按 IP 相关请求头。
- **`skip`**：返回 **`true` = 跳过**限流；**`false` = 应用**限流。默认 `() => false`。
- **计数**：先 `increment`，再判断 `current >= max + 1`。
- **默认内存存储**：多实例互不相通；集群限流需自定义 `Context`。

## 安装

```bash
npm install @vafast/rate-limit
```

## 快速开始

```typescript
import { Server, defineRoute, defineRoutes, json, serve } from 'vafast'
import { rateLimit } from '@vafast/rate-limit'

const routes = defineRoutes([
  defineRoute({
    method: 'GET',
    path: '/',
    handler: () => json({ ok: true }),
  }),
])

const server = new Server(routes)
server.use(
  rateLimit({
    max: 100,
    duration: 60_000,
    skip: (req) => new URL(req.url).pathname === '/health',
  }),
)
serve({ fetch: server.fetch, port: 3000 })
```

## 用法

### 全局 / 单路由

```typescript
server.use(rateLimit({ max: 100, duration: 60_000 }))

defineRoute({
  method: 'POST',
  path: '/login',
  middleware: [rateLimit({ max: 10, duration: 60_000 })],
  handler: () => json({ ok: true }),
})
```

### `skip` 语义

| 返回值 | 行为 |
|--------|------|
| `true` | 跳过：不计数、不 429 |
| `false` | 应用限流 |

- `skip.length < 2`：先 `skip(req)`，未跳过再生成 key
- `skip.length >= 2`：先生成 key，再 `skip(req, key)`

### 自定义 key

```typescript
rateLimit({
  max: 30,
  duration: 60_000,
  generator: (req) =>
    req.headers.get('authorization') ??
    req.headers.get('x-forwarded-for') ??
    'anonymous',
})
```

### `errorResponse` 三种形态

| 类型 | 行为 |
|------|------|
| `string` | 429 文本响应 |
| `Response` | `clone()` 后返回，并可追加限流头 |
| `Error` | 抛出 |

### 自定义 `Context`

| 方法 | 说明 |
|------|------|
| `init(options)` | 初始化 |
| `increment(key)` | 返回 `{ count, nextReset }` |
| `decrement(key)` | 下游抛错且 `countFailedRequest: false` 时退还 |
| `reset(key?)` | 重置单个或全部 |
| `kill()` | 清理 |

## API

### 导出

`rateLimit`、`DefaultContext`、`defaultOptions`，以及类型 `Options` / `Context` / `Generator`。

### `rateLimit(options?)`

| 参数 | 默认 | 说明 |
|------|------|------|
| `duration` | `60000` | 窗口毫秒；也用于 `Retry-After` |
| `max` | `10` | 窗口内最大请求数 |
| `errorResponse` | `'rate-limit reached'` | `string` / `Response` / `Error` |
| `countFailedRequest` | `false` | `false` 时下游抛错退还计数 |
| `generator` | 见下 | 限流 key |
| `context` | `new DefaultContext()` | 计数存储 |
| `skip` | `() => false` | `true` 跳过 |
| `headers` | `true` | 写 `RateLimit-*` / `Retry-After` |
| `injectServer` | — | 传给 generator 的 server |
| `scoping` | `'global'` | **未使用**（兼容字段） |

### 默认 `generator` 请求头顺序

1. `x-real-ip`
2. `x-forwarded-for`（取第一个）
3. `cf-connecting-ip`
4. `x-client-ip`
5. 回退 `ua:${user-agent || 'unknown'}`

### 响应头（`headers: true`）

| 头 | 说明 |
|----|------|
| `RateLimit-Limit` | 上限 |
| `RateLimit-Remaining` | 剩余 |
| `RateLimit-Reset` | 距重置秒数 |
| `Retry-After` | 仅超限；约 `ceil(duration / 1000)` |

## 最佳实践

- 敏感接口单独更小的 `max`。
- 反代后保证 IP 头可信，或自定义 `generator`。
- 探活用 `skip` 返回 `true` 排除。
- 多实例不要依赖默认内存 `DefaultContext` 做全局限流。

## 注意事项

- `scoping` 仅为兼容保留，不改变行为。
- `skip` 返回 `true` 才跳过。
- 超限判定：`current >= max + 1`（先递增再判断）。
- `countFailedRequest: false` 仅对下游 **抛错** 退还；正常 4xx/5xx 仍计数。
- 多实例 + 默认内存 ≠ 集群统一限流。

## 相关链接

- [文档站点 · Rate Limit](https://vafast.dev/middleware/rate-limit)
- [文档站点 · IP](https://vafast.dev/middleware/ip)

## License

MIT
