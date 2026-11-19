import { PassThrough } from 'node:stream'

import tus from 'tus-js-client'
import { expect, test } from 'vitest'

import { serializeSlices } from '../dist/server/helpers/tus-file-reader.js'

// A pause aborts the upload while a slice still waits for the source; the
// resumed upload then slices the same range again.
async function sliceTwiceWhileReading(
  fileReader: NonNullable<typeof tus.defaultOptions.fileReader>,
) {
  const stream = new PassThrough()
  const source = await fileReader.openFile(stream, 5)
  const aborted = source.slice(0, 5)
  const resumed = source.slice(0, 5)
  stream.write('first')
  stream.write('second')
  await aborted
  return (await resumed).value?.toString()
}

test('the real StreamSource gives a repeated slice other bytes while the first still reads', async () => {
  // Documents the tus-js-client behaviour that serializeSlices works around
  expect(await sliceTwiceWhileReading(tus.defaultOptions.fileReader)).not.toBe(
    'first',
  )
})

test('serialized slices give the resumed upload the same bytes', async () => {
  expect(
    await sliceTwiceWhileReading(
      serializeSlices(tus.defaultOptions.fileReader),
    ),
  ).toBe('first')
})
