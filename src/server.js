import http from 'http'
import { Server } from 'socket.io'
import { app } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { setupChatSocket } from './sockets/chat.socket.js'
import { startNotificationScheduler } from './utils/notification.scheduler.js'
import mongoose from 'mongoose'

let httpServer

const shutdownGracefully = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`)

  if (httpServer) {
    httpServer.close(async () => {
      await mongoose.connection.close()
      process.exit(0)
    })
  } else {
    process.exit(0)
  }
}

const bootstrap = async () => {
  await connectDB()

  httpServer = http.createServer(app)

  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin === '*' ? true : env.corsOrigin,
      credentials: true,
    },
  })

  setupChatSocket(io)

  // Start rule-based notification cron jobs
  startNotificationScheduler()

  httpServer.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`)
  })

  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use`)
      process.exit(1)
    }

    console.error('HTTP server error:', error)
    process.exit(1)
  })
}

process.on('SIGINT', () => shutdownGracefully('SIGINT'))
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'))

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server:', error)
  process.exit(1)
})
