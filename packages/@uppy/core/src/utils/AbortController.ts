import hasProperty from './hasProperty.js'
/**
 * Little AbortController proxy module so we can swap out the implementation easily later.
 */
export const { AbortController } = globalThis
export const { AbortSignal } = globalThis
// duck-typed, as an abort error is a DOMException, which may not extend Error
export const isAbortError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err != null &&
  'name' in err &&
  err.name === 'AbortError'

export const createAbortError = (
  message = 'Aborted',
  options?: Parameters<typeof Error>[1],
): DOMException => {
  const err = new DOMException(message, 'AbortError')
  if (options != null && hasProperty(options, 'cause')) {
    Object.defineProperty(err, 'cause', {
      // @ts-expect-error TS is drunk
      __proto__: null,
      configurable: true,
      writable: true,
      value: options.cause,
    })
  }
  return err
}
