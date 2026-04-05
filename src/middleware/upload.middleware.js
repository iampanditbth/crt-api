import multer from 'multer'
import { ApiError } from '../utils/ApiError.js'

const storage = multer.memoryStorage()

const allowedMimePrefixes = [
  'image/',
  'application/',
  'text/',
  'audio/',
  'video/',
]

const fileFilter = (_req, file, cb) => {
  if (!file) {
    cb(new ApiError(400, 'No file provided'))
    return
  }

  const mimeType = file.mimetype || ''
  const isAllowed = allowedMimePrefixes.some((prefix) =>
    mimeType.startsWith(prefix),
  )

  if (!isAllowed) {
    cb(new ApiError(400, 'Unsupported file type'))
    return
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
})
