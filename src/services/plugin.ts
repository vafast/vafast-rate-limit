import { defineMiddleware } from 'vafast'
import { text } from 'vafast'

import { defaultOptions } from "../constants/defaultOptions";
import { DefaultContext } from "./defaultContext";

import { logger } from "./logger";

import type { Options } from "../@types/Options";

export const plugin = function rateLimitPlugin(userOptions?: Partial<Options>) {
  const options: Options = {
    ...defaultOptions,
    ...userOptions,
    context: userOptions?.context ?? new DefaultContext(),
  };

  options.context.init(options);

  // 返回 vafast 中间件函数
  return defineMiddleware(async function rateLimitMiddleware(req, next) {
    let clientKey: string | undefined;

    /**
     * if a skip option has two parameters,
     * then we will generate clientKey ahead of time.
     * this is made to skip generating key unnecessary if only check for request
     * and saving some cpu consumption when actually skipped
     */
    if (options.skip.length >= 2)
      clientKey = await options.generator(
        req,
        options.injectServer?.() ?? null,
        {}
      );

    // if decided to skip, then do nothing and let the app continue
    if ((await options.skip(req, clientKey)) === false) {
      /**
       * if a skip option has less than two parameters,
       * that's mean clientKey does not have a key yet
       * then generate one
       */
      if (options.skip.length < 2)
        clientKey = await options.generator(
          req,
          options.injectServer?.() ?? null,
          {}
        );

      const { count, nextReset } = await options.context.increment(
        // biome-ignore lint/style/noNonNullAssertion: <explanation>
        clientKey!
      );

      const payload = {
        limit: options.max,
        current: count,
        remaining: Math.max(options.max - count, 0),
        nextReset,
      };

      // set standard headers
      const reset = Math.max(0, Math.ceil((nextReset.getTime() - Date.now()) / 1000));

      const builtHeaders: Record<string, string> = {
        "RateLimit-Limit": String(options.max),
        "RateLimit-Remaining": String(payload.remaining),
        "RateLimit-Reset": String(reset),
      };

      // reject if limit were reached
      if (payload.current >= payload.limit + 1) {
        logger(
          "plugin",
          "rate limit exceeded for clientKey: %s (resetting in %d seconds)",
          clientKey,
          reset
        );

        builtHeaders["Retry-After"] = String(Math.ceil(options.duration / 1000));

        if (options.errorResponse instanceof Error) throw options.errorResponse;
        if (options.errorResponse instanceof Response) {
          // duplicate the response to avoid mutation
          const clonedResponse = options.errorResponse.clone();

          // append headers
          if (options.headers)
            for (const [key, value] of Object.entries(builtHeaders))
              clonedResponse.headers.set(key, value);

          return clonedResponse;
        }

        // return error response with headers
        const errorMessage = typeof options.errorResponse === 'string' 
          ? options.errorResponse 
          : 'Too Many Requests'
        
        return text(errorMessage, 429, options.headers ? builtHeaders : {})
      }

      // continue with the request, but we need to intercept the response to add headers
      try {
        const response = await next();
        
        // append rate limit headers to the response
        if (options.headers) {
          const responseHeaders: Record<string, string> = {}
          
          // 手动遍历响应头部
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value
          })
          
          const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              ...responseHeaders,
              ...builtHeaders
            }
          });
          
          logger(
            "plugin",
            "clientKey %s passed through with %d/%d request used (resetting in %d seconds)",
            clientKey,
            options.max - payload.remaining,
            options.max,
            reset
          );
          
          return newResponse;
        }
        
        return response;
      } catch (error) {
        // if request failed and we should count failed requests
        if (!options.countFailedRequest) {
          logger("plugin", "request failed for clientKey: %s, refunding", clientKey);
          await options.context.decrement(clientKey!);
        }
        throw error;
      }
    } else {
      // skipped, just continue
      return next();
    }
  });
};
