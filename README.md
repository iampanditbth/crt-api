# Real-Time Chat Backend (MERN - Backend)

Production-ready Node.js backend for a real-time chat app with:

- Express.js REST APIs
- MongoDB + Mongoose
- Socket.IO real-time events
- JWT authentication
- Multer + Cloudinary uploads
- Read receipts, typing indicators, online/last-seen
- Emoji and sticker message support

## 1. Architecture

### Core stack

- Node.js
- Express.js
- MongoDB Atlas (or local MongoDB)
- Mongoose
- Socket.IO
- JWT
- Multer
- Cloudinary

### Folder structure

- src/config: environment, DB, cloudinary config
- src/controllers: API business logic
- src/models: Mongoose schemas
- src/routes: API routes
- src/middleware: auth, upload, error handlers
- src/sockets: real-time socket events
- src/utils: helpers (JWT, async wrappers, validators)

## 2. Features implemented

- Register/Login with JWT
- Protected routes with auth middleware
- Public/private room system with invite control
- Join/leave room
- Persisted messages in MongoDB
- Message types: text, image, file, link, sticker
- File upload to Cloudinary
- Typing indicators
- User online/offline + last seen
- Read receipts
- Safer validation and structured error mapping

## 3. Environment variables

Create .env:

NODE_ENV=development
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_jwt_secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_FOLDER=chat-app

## 4. Local run

1. Install dependencies:

npm install

2. Start dev server:

npm run dev

3. Health check:

- GET http://localhost:5001/
- GET http://localhost:5001/api/health

## 5. REST API list (URL + Method)

Base URL:
http://localhost:5001

### Auth

- POST /api/auth/register
- POST /api/auth/login

#### POST /api/auth/register

Body (JSON):
{
"username": "user1",
"email": "user1@example.com",
"password": "Pass1234"
}

#### POST /api/auth/login

Body (JSON):
{
"email": "user1@example.com",
"password": "Pass1234"
}

### Rooms (Protected)

- POST /api/rooms/create
- GET /api/rooms
- POST /api/rooms/join
- POST /api/rooms/leave

Header for protected APIs:
Authorization: Bearer <JWT_TOKEN>

#### POST /api/rooms/create

Body (JSON):
{
"name": "General",
"isPrivate": false
}

Private room example:
{
"name": "Leadership",
"isPrivate": true,
"invitedUsers": ["<USER_ID_1>", "<USER_ID_2>"]
}

#### POST /api/rooms/join

Body (JSON):
{
"roomId": "<ROOM_ID>"
}

#### POST /api/rooms/leave

Body (JSON):
{
"roomId": "<ROOM_ID>"
}

### Messages (Protected)

- GET /api/messages/:roomId
- POST /api/messages/upload
- DELETE /api/messages/:messageId

#### GET /api/messages/:roomId

Returns up to 200 messages sorted by oldest-first.

#### POST /api/messages/upload

Content-Type: multipart/form-data
Fields:

- roomId (text, required)
- messageType (text, required: image | file | sticker)
- content (text, optional)
- file (file, required)

Example use case:

- Upload image or file to Cloudinary
- Save returned URL in message document

#### DELETE /api/messages/:messageId

Deletes a message from MongoDB.
If the message contains a Cloudinary file, it is removed from Cloudinary too.

Authorization rule:

- message sender can delete
- room creator can delete

## 6. Socket.IO real-time API

Socket auth:

- Send JWT token via socket.handshake.auth.token
- or Authorization header: Bearer <JWT_TOKEN>

### Client -> Server events

- room:join
  payload: { roomId }
- room:leave
  payload: { roomId }
- message:send
  payload:
  {
  roomId,
  messageType, // text | image | file | link | sticker
  content, // text/link/sticker label/emoji
  fileUrl, // required for image/file, optional for sticker
  fileName,
  mimeType,
  fileSize
  }
- typing:start
  payload: { roomId }
- typing:stop
  payload: { roomId }
- message:read
  payload: { messageId }
- message:delete
  payload: { messageId }

### Server -> Client events

- message:new
- typing:update
- message:read-update
- message:deleted
- room:user-joined
- room:user-left
- user:status
- error:socket

### Emoji and stickers

- Emoji are fully supported in text content.
- Sticker messages are supported using messageType=sticker.
- For stickers you can send:
  - content as sticker identifier/emoticon
  - fileUrl as sticker image URL

## 7. Validation and crash-safety

Implemented protections:

- Request body checks for malformed payloads
- ObjectId validation
- Message type validation
- URL validation for link messages
- Upload MIME checks + size limit (10MB)
- Multer/Mongoose/JWT error mapping in global error middleware
- Process-level handlers (uncaughtException, unhandledRejection)
- Graceful shutdown hooks (SIGINT, SIGTERM)

## 8. Postman testing order

1. Register
2. Login
3. Create room
4. Join room
5. Get room messages
6. Upload a file message
7. Send real-time messages from Socket.IO client

Tip: store token and roomId as Postman environment variables.

## 9. Render deployment guide

### A. Prepare repo

1. Push this project to GitHub.
2. Ensure package.json scripts include:

- start: node src/index.js

### B. Create Render Web Service

1. Dashboard -> New -> Web Service
2. Connect GitHub repo
3. Runtime: Node
4. Build Command:

npm install

5. Start Command:

npm start

### C. Add Environment Variables in Render

Set all from .env:

- NODE_ENV=production
- PORT=10000 (Render sets PORT automatically, app already reads PORT)
- MONGODB_URI
- JWT_SECRET
- JWT_EXPIRES_IN
- CORS_ORIGIN
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- CLOUDINARY_UPLOAD_FOLDER

### D. Important for Socket.IO on Render

- Use the same Render service URL for API and Socket.IO.
- Enable client reconnection.
- Use secure WebSocket (wss) in production (auto when using https URL).
- Keep CORS origin aligned with frontend domain.

### E. Verify after deploy

- GET https://<your-service>.onrender.com/api/health
- Register/Login from Postman
- Room create/join
- Socket connection and real-time message flow

## 10. Production recommendations (next step)

- Add refresh tokens and logout invalidation
- Add Redis adapter for Socket.IO scaling
- Add pagination cursors for large message history
- Add automated tests (Jest + Supertest + socket integration)
- Add API docs UI (Swagger/OpenAPI)
