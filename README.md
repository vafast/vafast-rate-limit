# @vafast/rate-limit

Lightweight rate limiter plugin for [Vafast](https://github.com/vafastjs/vafast).

## Installation

```bash
npm install @vafast/rate-limit
# or
npm install @vafast/rate-limit
```

## Usage

```typescript
import { Server, createHandler } from 'vafast'
import { rateLimit } from '@vafast/rate-limit'

const rateLimitMiddleware = rateLimit({
  max: 10,
  duration: 60000 // 1 minute
})

const routes = [
  {
    method: 'GET',
    path: '/',
    middleware: [rateLimitMiddleware],
    handler: createHandler(() => {
      return { message: 'Hello World' }
    })
  }
]

const server = new Server(routes)

export default {
  fetch: (req: Request) => server.fetch(req)
}
```

## Configuration

### max

@default `10`

Maximum number of requests allowed during the duration timeframe.

### duration

@default `60000`

Duration for requests to be remembered in **milliseconds**.
Also used in the `Retry-After` header when the limit is reached.

### errorResponse

@default `'rate-limit reached'`

Response to be sent when the rate limit is reached.
Can be a `string`, `Response` object, or `Error` object.

### generator

Custom key generator to categorize client requests, return as a string.
By default, this plugin will categorize client by their IP address.

### skip

`(request: Request, key: string): boolean | Promise<boolean>`

A custom function to determine if this request should be counted into rate-limit or not.

### headers

@default `true`

Should this plugin automatically set `RateLimit-*` headers to the response?

## License

MIT
