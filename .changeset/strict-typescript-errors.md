---
"@uppy/core": minor
"@uppy/audio": patch
"@uppy/aws-s3": patch
"@uppy/companion": patch
"@uppy/dashboard": patch
"@uppy/screen-capture": patch
"@uppy/thumbnail-generator": patch
"@uppy/transloadit": patch
"@uppy/tus": patch
"@uppy/url": patch
"@uppy/webcam": patch
"@uppy/xhr-upload": patch
---

Stricter TypeScript: extend `@tsconfig/strictest` and type caught errors as `unknown`.

- `@uppy/core/utils`: add `toError`, `isAbortError` and `isRestrictionError` helpers.
- `@uppy/webcam`: `icon` is now public, like on other acquirer plugins.
- `@uppy/url`: `handleRootDrop` and `handleRootPaste` are now public, as Dashboard and DropTarget call them. `addFile()` now resolves to `undefined` on failure, as per its type.
- `@uppy/companion`: throw a clear error for an unknown provider in the test dynamic OAuth credentials endpoint.
