import mongoose from 'mongoose'
import fs from 'fs'
import { Message } from '../models/Message.js'
import { Room } from '../models/Room.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import {
  asTrimmedString,
  isValidMessageType,
  isValidObjectId,
} from '../utils/validate.js'
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js'

const ensureRoomMembership = async (roomId, userId) => {
  const room = await Room.findById(roomId)
  if (!room) {
    throw new ApiError(404, 'Room not found')
  }

  const isMember = room.members.some((id) => String(id) === String(userId))
  if (!isMember) {
    throw new ApiError(403, 'You must join the room first')
  }

  return room
}

export const getMessagesByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params

  if (!isValidObjectId(roomId)) {
    throw new ApiError(400, 'Invalid roomId')
  }

  await ensureRoomMembership(roomId, req.user._id)

  const messages = await Message.find({ roomId })
    .populate('sender', '_id username email')
    .populate('replyTo')
    .sort({ createdAt: 1 })
    .limit(200)

  res.status(200).json({
    success: true,
    messages,
  })
})

export const uploadFileMessage = asyncHandler(async (req, res) => {
  const roomId = req.body?.roomId
  const messageType = asTrimmedString(req.body?.messageType, 'file')
  const content = asTrimmedString(req.body?.content)
  const replyTo = req.body?.replyTo || null

  if (!isValidObjectId(roomId)) {
    throw new ApiError(
      400,
      'Valid roomId is required in form-data (key: roomId)',
    )
  }

  // Validate replyTo if provided
  if (replyTo && !isValidObjectId(replyTo)) {
    throw new ApiError(400, 'Invalid replyTo message ID')
  }

  if (!isValidMessageType(messageType)) {
    throw new ApiError(400, 'Invalid messageType')
  }

  if (!['image', 'file', 'sticker'].includes(messageType)) {
    throw new ApiError(400, 'messageType must be image, file, or sticker')
  }

  if (!req.file) {
    throw new ApiError(400, 'No file uploaded')
  }

  await ensureRoomMembership(roomId, req.user._id)

  const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
    resource_type: 'auto',
    public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    use_filename: true,
    unique_filename: true,
    filename_override: req.file.originalname,
  })

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const message = await Message.create({
    roomId,
    sender: req.user._id,
    messageType,
    content,
    replyTo,
    fileUrl: uploadResult.secure_url || uploadResult.url || '',
    cloudinaryPublicId: uploadResult.public_id || '',
    cloudinaryResourceType: uploadResult.resource_type || 'raw',
    expiresAt,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    readBy: [{ user: req.user._id }],
  })

  await message.populate('sender', '_id username email')
  if (replyTo) {
    await message.populate('replyTo')
  }

  res.status(201).json({
    success: true,
    message,
  })
})

export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params
  const userId = String(req.user._id)

  if (!isValidObjectId(messageId)) {
    throw new ApiError(400, 'Invalid messageId')
  }

  const message = await Message.findById(messageId)
  if (!message) {
    throw new ApiError(404, 'Message not found')
  }

  const room = await Room.findById(message.roomId)
  if (!room) {
    throw new ApiError(404, 'Room not found')
  }

  const isSender = String(message.sender) === userId
  const isRoomCreator = String(room.createdBy) === userId

  if (!isSender && !isRoomCreator) {
    throw new ApiError(
      403,
      'Only the sender or room creator can delete this message',
    )
  }

  // Delete local file if it exists
  if (message.localFilePath && fs.existsSync(message.localFilePath)) {
    fs.unlinkSync(message.localFilePath)
  }

  await message.deleteOne()

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully',
    deletedMessageId: messageId,
  })
})

export const downloadFile = asyncHandler(async (req, res) => {
  const { messageId } = req.params

  if (!isValidObjectId(messageId)) {
    throw new ApiError(400, 'Invalid messageId')
  }

  const message = await Message.findById(messageId)
  if (!message) {
    throw new ApiError(404, 'Message not found')
  }

  await ensureRoomMembership(message.roomId, req.user._id)

  if (message.isDeletedFromServer || !message.fileUrl) {
    throw new ApiError(410, 'File has already been removed from the server.')
  }

  const hasDownloaded = message.downloadedBy.some(
    (d) => String(d.user) === String(req.user._id),
  )

  if (String(message.sender) !== String(req.user._id) && !hasDownloaded) {
    message.downloadedBy.push({ user: req.user._id })
    await message.save()
  }

  res.status(200).json({
    success: true,
    url: message.fileUrl,
    fileName: message.fileName,
    mimeType: message.mimeType,
  })
})

export const shareMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params
  const { targetRoomId } = req.body

  if (!isValidObjectId(messageId) || !isValidObjectId(targetRoomId)) {
    throw new ApiError(400, 'Invalid messageId or targetRoomId')
  }

  const originalMessage = await Message.findById(messageId)
  if (!originalMessage) {
    throw new ApiError(404, 'Message not found')
  }

  await ensureRoomMembership(originalMessage.roomId, req.user._id)
  await ensureRoomMembership(targetRoomId, req.user._id)

  const newMessage = await Message.create({
    roomId: targetRoomId,
    sender: req.user._id,
    messageType: originalMessage.messageType,
    content: originalMessage.content,
    isShared: true,
    fileUrl: originalMessage.fileUrl,
    fileName: originalMessage.fileName,
    mimeType: originalMessage.mimeType,
    fileSize: originalMessage.fileSize,
    readBy: [{ user: req.user._id }],
  })

  await newMessage.populate('sender', '_id username email')

  res.status(201).json({
    success: true,
    message: newMessage,
  })
})

export const acknowledgeDownload = asyncHandler(async (req, res) => {
  const { messageId } = req.params

  if (!isValidObjectId(messageId)) {
    throw new ApiError(400, 'Invalid messageId')
  }

  const message = await Message.findById(messageId)
  if (!message) {
    throw new ApiError(404, 'Message not found')
  }

  // Double check membership just in case
  await ensureRoomMembership(message.roomId, req.user._id)

  // Mark as downloaded if not already
  const hasDownloaded = message.downloadedBy.some(
    (d) => String(d.user) === String(req.user._id),
  )

  if (String(message.sender) !== String(req.user._id) && !hasDownloaded) {
    message.downloadedBy.push({ user: req.user._id })
  }

  // Delete from Cloudinary if not already deleted.
  if (!message.isDeletedFromServer && message.cloudinaryPublicId) {
    try {
      await deleteFromCloudinary(
        message.cloudinaryPublicId,
        message.cloudinaryResourceType || 'auto',
      )
      message.isDeletedFromServer = true
    } catch (error) {
      console.error('Failed to delete from Cloudinary', error)
    }
  }

  await message.save()

  res.status(200).json({
    success: true,
    message: 'Message downloaded and server copy cleared',
    isDeletedFromServer: message.isDeletedFromServer,
  })
})
