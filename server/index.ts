import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

interface RoomState {
  size: 3 | 4 | 5
  marked: Record<string, boolean[]>
  usernames: Record<string, string>
}

const rooms = new Map<string, RoomState>()

io.on('connection', (socket) => {
  console.log('User connected', socket.id)

  socket.on('join-room', ({ roomId, size, user }: { roomId: string; size: 3 | 4 | 5; user?: string }) => {
    socket.join(roomId)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        size,
        marked: {},
        usernames: {},
      })
    }

    const room = rooms.get(roomId)!
    room.marked[socket.id] = Array(room.size * room.size).fill(false)
    room.usernames[socket.id] = user ?? socket.id

    io.to(socket.id).emit('room-state', {
      size: room.size,
      players: Object.values(room.usernames),
    })

    io.to(roomId).emit('user-joined', room.usernames[socket.id])
  })

  socket.on('mark', ({ roomId, index }) => {
    const room = rooms.get(roomId)
    if (!room) return

    const board = room.marked[socket.id]
    if (!board) return
    if (typeof index !== 'number' || index < 0 || index >= board.length) return

    board[index] = !board[index]

    socket.to(roomId).emit('mark', {
      user: room.usernames[socket.id] ?? socket.id,
      index,
    })
  })

  socket.on('bingo', ({ roomId }) => {
    const room = rooms.get(roomId)
    const name = room ? room.usernames[socket.id] ?? socket.id : socket.id
    socket.to(roomId).emit('bingo', name)
  })

  socket.on('disconnect', () => {
    rooms.forEach((room, key) => {
      delete room.marked[socket.id]
      if (Object.keys(room.marked).length === 0) {
        rooms.delete(key)
      }
    })
  })
})

server.listen(3001, () => {
  console.log('Socket server running on :3001')
})
