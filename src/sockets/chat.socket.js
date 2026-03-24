import mongoose from 'mongoose'
import { Message } from '../models/Message.js'
import { Room } from '../models/Room.js'
import { User } from '../models/User.js'
import { verifyToken } from '../utils/jwt.js'
import { deleteFromCloudinary } from '../utils/cloudinaryUpload.js'
import {
  asTrimmedString,
  isLikelyUrl,
  isValidMessageType,
  isValidObjectId,
} from '../utils/validate.js'

const userSocketMap = new Map()

const getUserSockets = (userId) =>
  userSocketMap.get(String(userId)) || new Set()

const addUserSocket = (userId, socketId) => {
  const key = String(userId)
  const sockets = getUserSockets(key)
  sockets.add(socketId)
  userSocketMap.set(key, sockets)
}

const removeUserSocket = (userId, socketId) => {
  const key = String(userId)
  const sockets = getUserSockets(key)
  sockets.delete(socketId)

  if (sockets.size === 0) {
    userSocketMap.delete(key)
  } else {
    userSocketMap.set(key, sockets)
  }
}

const canAccessRoom = async (room, userId) => {
  const id = String(userId)

  if (!room.isPrivate) {
    return true
  }

  return (
    String(room.createdBy) === id ||
    room.members.some((memberId) => String(memberId) === id) ||
    room.invitedUsers.some((invitedId) => String(invitedId) === id)
  )
}

export const setupChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization || ''
      const tokenFromHeader = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null
      const token = socket.handshake.auth?.token || tokenFromHeader

      if (!token) {
        return next(new Error('Unauthorized: token missing'))
      }

      const decoded = verifyToken(token)
      const user = await User.findById(decoded.userId).select(
        '_id username email',
      )

      if (!user) {
        return next(new Error('Unauthorized: user not found'))
      }

      socket.user = user
      next()
    } catch (_error) {
      next(new Error('Unauthorized: invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id)

    addUserSocket(userId, socket.id)
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    })
    io.emit('user:status', { userId, isOnline: true, lastSeen: new Date() })

    socket.on('room:join', async (payload) => {
      try {
        const roomId = payload?.roomId

        if (!isValidObjectId(roomId)) {
          socket.emit('error:socket', { message: 'Invalid roomId' })
          return
        }

        const room = await Room.findById(roomId)
        if (!room) {
          socket.emit('error:socket', { message: 'Room not found' })
          return
        }

        const allowed = await canAccessRoom(room, userId)
        if (!allowed) {
          socket.emit('error:socket', {
            message: 'Access denied to private room',
          })
          return
        }

        const isMember = room.members.some((id) => String(id) === userId)
        if (!isMember) {
          room.members.push(userId)
          await room.save()
        }

        socket.join(roomId)
        io.to(roomId).emit('room:user-joined', {
          roomId,
          user: {
            _id: socket.user._id,
            username: socket.user.username,
            email: socket.user.email,
          },
        })
      } catch (_error) {
        socket.emit('error:socket', { message: 'Failed to join room' })
      }
    })

    socket.on('room:leave', async (payload) => {
      try {
        const roomId = payload?.roomId

        if (!isValidObjectId(roomId)) {
          socket.emit('error:socket', { message: 'Invalid roomId' })
          return
        }

        const room = await Room.findById(roomId)
        if (!room) {
          socket.emit('error:socket', { message: 'Room not found' })
          return
        }

        room.members = room.members.filter((id) => String(id) !== userId)
        await room.save()

        socket.leave(roomId)
        io.to(roomId).emit('room:user-left', {
          roomId,
          userId,
        })
      } catch (_error) {
        socket.emit('error:socket', { message: 'Failed to leave room' })
      }
    })

    socket.on('message:send', async (payload) => {
      try {
        const roomId = payload?.roomId
        const messageType = asTrimmedString(payload?.messageType, 'text')
        const content = asTrimmedString(payload?.content)
        const fileUrl = asTrimmedString(payload?.fileUrl)
        const fileName = asTrimmedString(payload?.fileName)
        const mimeType = asTrimmedString(payload?.mimeType)
        const fileSize = Number(payload?.fileSize || 0)

        if (!isValidObjectId(roomId)) {
          socket.emit('error:socket', { message: 'Invalid roomId' })
          return
        }

        if (!isValidMessageType(messageType)) {
          socket.emit('error:socket', { message: 'Invalid messageType' })
          return
        }

        const room = await Room.findById(roomId)
        if (!room) {
          socket.emit('error:socket', { message: 'Room not found' })
          return
        }

        const isMember = room.members.some((id) => String(id) === userId)
        if (!isMember) {
          socket.emit('error:socket', {
            message: 'Join room before sending messages',
          })
          return
        }

        if ((messageType === 'text' || messageType === 'link') && !content) {
          socket.emit('error:socket', { message: 'content is required' })
          return
        }

        if (messageType === 'link' && !isLikelyUrl(content)) {
          socket.emit('error:socket', {
            message: 'Link messages must be valid URLs',
          })
          return
        }

        if ((messageType === 'image' || messageType === 'file') && !fileUrl) {
          socket.emit('error:socket', {
            message: 'fileUrl is required for file/image messages',
          })
          return
        }

        if (messageType === 'sticker' && !fileUrl && !content) {
          socket.emit('error:socket', {
            message: 'Sticker messages need sticker URL or sticker identifier',
          })
          return
        }

        const message = await Message.create({
          roomId,
          sender: userId,
          messageType,
          content,
          fileUrl,
          fileName,
          mimeType,
          fileSize,
          readBy: [{ user: userId }],
        })

        await message.populate('sender', '_id username email')

        io.to(roomId).emit('message:new', message)
      } catch (_error) {
        socket.emit('error:socket', { message: 'Failed to send message' })
      }
    })

    socket.on('typing:start', (payload) => {
      const roomId = payload?.roomId
      if (!isValidObjectId(roomId)) {
        return
      }

      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        username: socket.user.username,
        isTyping: true,
      })
    })

    socket.on('typing:stop', (payload) => {
      const roomId = payload?.roomId
      if (!isValidObjectId(roomId)) {
        return
      }

      socket.to(roomId).emit('typing:update', {
        roomId,
        userId,
        username: socket.user.username,
        isTyping: false,
      })
    })

    socket.on('message:read', async (payload) => {
      try {
        const messageId = payload?.messageId

        if (!isValidObjectId(messageId)) {
          return
        }

        const message = await Message.findById(messageId)
        if (!message) {
          return
        }

        const alreadyRead = message.readBy.some(
          (entry) => String(entry.user) === userId,
        )
        if (!alreadyRead) {
          message.readBy.push({ user: userId, readAt: new Date() })
          await message.save()
        }

        io.to(String(message.roomId)).emit('message:read-update', {
          messageId: message._id,
          userId,
          readAt: new Date(),
        })
      } catch (_error) {
        socket.emit('error:socket', { message: 'Failed to set read receipt' })
      }
    })

    socket.on('message:delete', async (payload) => {
      try {
        const messageId = payload?.messageId

        if (!isValidObjectId(messageId)) {
          socket.emit('error:socket', { message: 'Invalid messageId' })
          return
        }

        const message = await Message.findById(messageId)
        if (!message) {
          socket.emit('error:socket', { message: 'Message not found' })
          return
        }

        const room = await Room.findById(message.roomId)
        if (!room) {
          socket.emit('error:socket', { message: 'Room not found' })
          return
        }

        const isSender = String(message.sender) === userId
        const isRoomCreator = String(room.createdBy) === userId

        if (!isSender && !isRoomCreator) {
          socket.emit('error:socket', {
            message: 'Only the sender or room creator can delete this message',
          })
          return
        }

        if (message.cloudinaryPublicId) {
          await deleteFromCloudinary(
            message.cloudinaryPublicId,
            message.cloudinaryResourceType || 'image',
          )
        }

        await message.deleteOne()

        io.to(String(room._id)).emit('message:deleted', {
          messageId,
          roomId: String(room._id),
          deletedBy: userId,
        })
      } catch (_error) {
        socket.emit('error:socket', { message: 'Failed to delete message' })
      }
    })

    socket.on('disconnect', async () => {
      removeUserSocket(userId, socket.id)
      const hasOtherSockets = getUserSockets(userId).size > 0

      if (!hasOtherSockets) {
        const lastSeen = new Date()
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
        io.emit('user:status', { userId, isOnline: false, lastSeen })
      }
    })
  })
}
