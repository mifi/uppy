import type { RestrictionError } from '../Restricter.js'

// duck-typed because `instanceof` is unsafe across multiple copies of @uppy/core
export default function isRestrictionError(
  err: unknown,
): err is RestrictionError<any, any> {
  return (
    typeof err === 'object' &&
    err != null &&
    'isRestriction' in err &&
    err.isRestriction === true
  )
}
