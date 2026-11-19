import type { AddressInfo } from 'node:net'

import type { Request } from 'express'

import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'

import { expect, test } from 'vitest'

import { defaultOptions } from '../dist/config/companion.js'
import Emitter from '../dist/server/emitter/index.js'
import Uploader from '../dist/server/Uploader.js'

test('pausing while tus waits for a slow source loses no bytes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'companion-tus-slice-'))
  let stored = Buffer.alloc(0)
  const patched = Promise.withResolvers<void>()
  const server = createServer((req, res) => {
    const tus = { 'Tus-Resumable': '1.0.0' }
    if (req.method === 'POST') {
      res.writeHead(201, { ...tus, Location: '/files/1' }).end()
    } else if (req.method === 'HEAD') {
      res
        .writeHead(200, {
          ...tus,
          'Upload-Offset': String(stored.length),
          'Upload-Length': '15',
        })
        .end()
    } else if (req.method === 'PATCH') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        // as a real tus server, refuse a PATCH that isn't at the current end
        if (Number(req.headers['upload-offset']) !== stored.length) {
          res.writeHead(409, tus).end()
          return
        }
        stored = Buffer.concat([stored, ...chunks])
        res
          .writeHead(204, { ...tus, 'Upload-Offset': String(stored.length) })
          .end()
        patched.resolve()
      })
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const port = (server.address() as AddressInfo).port
    const uploader = new Uploader({
      companionOptions: { ...defaultOptions, streamingUpload: true },
      endpoint: `http://127.0.0.1:${port}/files`,
      protocol: 'tus',
      size: 15,
      chunkSize: 5,
      pathPrefix: dir,
      metadata: { name: 'file.txt' },
    })
    const source = new PassThrough()
    const upload = uploader.uploadStream(source, {} as Request)
    upload.catch(() => {})
    source.write('hello')
    await patched.promise
    // tus now waits for the source to fill the next chunk
    await new Promise((resolve) => setTimeout(resolve, 100))
    Emitter().emit(`pause:${uploader.token}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
    Emitter().emit(`resume:${uploader.token}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
    source.write('world')
    await new Promise((resolve) => setTimeout(resolve, 100))
    source.end('again')
    await expect(upload).resolves.toBeDefined()
    expect(stored.toString()).toBe('helloworldagain')
    uploader.removeEmitterListeners()
  } finally {
    server.closeAllConnections()
    server.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
