import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import roomRoutes from './routes/room.routes.js'
import messageRoutes from './routes/message.routes.js'
import mentorRoutes from './routes/mentor.routes.js'
import profileRoutes from './routes/profile.routes.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'

export const app = express()

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin,
    credentials: true,
  }),
)
app.use(helmet())
app.use(morgan('combined'))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Too many requests from this IP, please try again later',
  }),
)

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Realtime Chat API is running',
    health: '/api/health',
  })
})

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end()
})

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Chat API is running',
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/mentor', mentorRoutes)
app.use('/api/profile', profileRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
