type MaybePromise<T> = T | Promise<T>

export type Generator<T extends object = {}> = (
  request: Request,
  server: any | null,
  derived: T
) => MaybePromise<string>
