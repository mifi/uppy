---
'@uppy/companion': patch
---

Fix tus uploads hanging or failing when they are paused and resumed while a chunk is still being read from the source. The resumed upload read the bytes after that chunk and sent them at the chunk's offset, which the server refused.
