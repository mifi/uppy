---
"@uppy/webcam": patch
"@uppy/audio": patch
"@uppy/core": patch
"@uppy/status-bar": patch
"@uppy/transloadit": patch
"@uppy/locales": patch
---

Remove unused locale strings (`creatingAssembly`, `logIn`, `resetSearch`, `emptyFolderAdded`, `folderAlreadyAdded`, `folderAdded`), move `failedToAddFiles` to `@uppy/core` where it's used, and label the webcam/audio recording length counter for screen readers again.
