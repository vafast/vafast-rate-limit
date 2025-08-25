import type { Context } from './Context'
import type { Generator } from './Generator'

export interface Options {
  // The duration for plugin to remember the requests (Default: 60000ms)
  duration: number

  // Maximum of requests per specified duration (Default: 10)
  max: number

  // Object to response when rate-limit reached
  errorResponse: string | Response | Error

  // scoping for rate limiting (kept for compatibility, but not used in vafast)
  scoping: 'global' | 'scoped'

  // should the rate limit be counted when a request result is failed (Default: false)
  countFailedRequest: boolean

  // key generator function to categorize client for rate-limiting
  generator: Generator<any>

  // context for storing requests count
  context: Context

  // exposed functions for writing a custom script to skip counting i.e.,
  // not counting rate limit for some requests
  // (Default: always return false)
  skip: (req: Request, key?: string) => boolean | Promise<boolean>

  // an explicit way to inject server instance to generator function
  // uses this as last resort only
  // since this function will slightly reduce server performance
  // (Default: not defined)
  injectServer?: () => any | null

  // let the plugin in control of RateLimit-* headers
  // (Default: true)
  headers: boolean
}
