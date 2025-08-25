import { logger } from "./logger";

import type { Generator } from "../@types/Generator";

export const defaultKeyGenerator: Generator = (request, server): string => {
  if (!request) {
    console.warn(
      "[@vafast/rate-limit] failed to determine client address (reason: request is undefined)"
    );
    return "";
  }

  // 从请求头中获取 IP 地址
  let clientAddress: string | undefined;

  // 尝试从各种头部获取 IP 地址
  const xRealIp = request.headers.get('x-real-ip');
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  const xClientIp = request.headers.get('x-client-ip');

  if (xRealIp) {
    clientAddress = xRealIp;
  } else if (xForwardedFor) {
    // x-forwarded-for 可能包含多个 IP，取第一个
    clientAddress = xForwardedFor.split(',')[0].trim();
  } else if (cfConnectingIp) {
    clientAddress = cfConnectingIp;
  } else if (xClientIp) {
    clientAddress = xClientIp;
  }

  logger("generator", "clientAddress: %s", clientAddress);

  if (clientAddress === undefined) {
    console.warn(
      `[@vafast/rate-limit] failed to determine client address from headers`
    );
    // 如果无法获取 IP，使用 User-Agent 作为备用标识
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `ua:${userAgent}`;
  }

  return clientAddress;
};
