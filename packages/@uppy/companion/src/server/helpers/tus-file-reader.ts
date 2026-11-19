import type tus from 'tus-js-client'

type FileReader = NonNullable<
  NonNullable<ConstructorParameters<typeof tus.Upload>[1]>['fileReader']
>

/**
 * tus-js-client's abort() doesn't wait for a slice that is still reading the
 * source, and its PATCH still goes out once the slice resolves. After a pause
 * and resume, the resumed slice read the same stream concurrently, got the
 * *following* bytes and sent them at the same offset, so the upload stalled,
 * or failed once the source ended. Serve one slice at a time: the resumed
 * slice then gets the same bytes from the source's buffer, the duplicate PATCH
 * is refused (409), and tus's retry resyncs the offset.
 */
export function serializeSlices(fileReader: FileReader): FileReader {
  return {
    async openFile(input, chunkSize) {
      const source = await fileReader.openFile(input, chunkSize)
      let previous: Promise<unknown> = Promise.resolve()
      return {
        size: source.size,
        slice(start, end) {
          const result = previous.then(() => source.slice(start, end))
          previous = result.catch(() => {})
          return result
        },
        close: () => source.close(),
      }
    },
  }
}
