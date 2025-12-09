const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');
const ReadState = require('./models/ReadState');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wechat-clone';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const groupRoutes = require('./routes/groups');
const chatRoutes = require('./routes/chats');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/chats', chatRoutes);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

// expose io globally for routes to emit events
global._io = io;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
    if (socket.data && socket.data.userId) {
      ReadState.findOneAndUpdate(
        { user: socket.data.userId, room },
        { $set: { lastReadAt: new Date() } },
        { upsert: true }
      ).catch(() => {});
    }
  });

  // identify user to join personal room for direct notifications
  socket.on('identify', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} identified as user:${userId}`);
      socket.data.userId = userId;
    }
  });

  socket.on('send_message', (data) => {
    // data: { room, sender, senderId?, content, type?, timestamp }
    // Persist message to database and broadcast with ISO timestamp
    (async () => {
      try {
        let senderId = data.senderId || null;
        let senderProfile = null;
        if (!senderId && data.sender) {
          const senderUser = await User.findOne({ username: data.sender }).select('_id username nickname avatar');
          if (senderUser) {
            senderId = senderUser._id;
            senderProfile = senderUser;
          }
        } else if (senderId) {
          const senderUser = await User.findById(senderId).select('username nickname avatar');
          if (senderUser) senderProfile = senderUser;
        }

        const saved = await new Message({
          room: data.room,
          content: data.content,
          sender: senderId,
          type: data.type || 'text',
          createdAt: new Date()
        }).save();

        const broadcast = {
          room: data.room,
          sender: data.sender,
          senderId: senderId ? senderId.toString() : undefined,
          senderNickname: senderProfile ? senderProfile.nickname : undefined,
          senderAvatar: senderProfile ? senderProfile.avatar : undefined,
          content: data.content,
          type: saved.type,
          timestamp: saved.createdAt.toISOString()
        };
        io.to(data.room).emit('receive_message', broadcast);

        // notify recipients who may not be in the room
        try {
          const recipients = [];
          if (data.room.includes('_')) {
            // DM room: two userIds joined with '_'
            const ids = data.room.split('_');
            for (const uid of ids) {
              recipients.push(uid);
            }
          } else {
            // Group room: groupId
            const group = await Group.findById(data.room).select('members');
            if (group && Array.isArray(group.members)) {
              for (const uid of group.members) {
                recipients.push(uid.toString());
              }
            }
          }

          // exclude sender
          const senderStr = senderId ? senderId.toString() : null;
          for (const rid of recipients) {
            if (senderStr && rid === senderStr) continue;
            io.to(`user:${rid}`).emit('message_notification', broadcast);
          }
        } catch (notifyErr) {
          console.error('Failed to notify recipients:', notifyErr);
        }
      } catch (err) {
        console.error('Failed to persist message:', err);
        io.to(data.room).emit('receive_message', {
          room: data.room,
          sender: data.sender,
          senderId: data.senderId,
          senderNickname: undefined,
          senderAvatar: undefined,
          content: data.content,
          type: data.type || 'text',
          timestamp: new Date().toISOString()
        });
      }
    })();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
