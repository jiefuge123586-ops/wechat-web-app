const router = require('express').Router();
const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const ReadState = require('../models/ReadState');
const jwt = require('jsonwebtoken');

const verify = (req, res, next) => {
  const token = req.header('auth-token');
  if (!token) return res.status(401).send('Access Denied');
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secretKey');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send('Invalid Token');
  }
};

// Get recent chats (groups + DMs)
router.get('/', verify, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get all groups user is in
    const groups = await Group.find({ members: userId }).lean();
    
    // 2. Get all DMs (friends) - simple approach: fetch friends
    const user = await User.findById(userId).populate('friends', 'username nickname avatar').lean();
    const friends = user.friends || [];

    // 3. Prepare chat list
    let chatList = [];

    // Process Groups
    for (let group of groups) {
      // Find last message
      // Ensure we sort correctly and wait for query
      const lastMsg = await Message.findOne({ room: group._id.toString() })
        .sort({ createdAt: -1 }); // .limit(1) is implicit with findOne but sorting matters
      
      chatList.push({
        id: group._id,
        type: 'group',
        name: group.name,
        avatar: group.avatar,
        lastMessage: lastMsg ? (lastMsg.type === 'image' ? '[图片]' : lastMsg.content) : '暂无消息',
        time: lastMsg ? lastMsg.createdAt : group.createdAt,
        rawTime: lastMsg ? new Date(lastMsg.createdAt) : new Date(group.createdAt)
      });
    }

    // Process DMs
    for (let friend of friends) {
      const roomId = [userId, friend._id.toString()].sort().join('_');
      
      const lastMsg = await Message.findOne({ room: roomId })
        .sort({ createdAt: -1 });

      // Always push if they are friends, even if no messages
      chatList.push({
        id: friend._id,
        type: 'dm',
        name: friend.nickname || friend.username,
        avatar: friend.avatar,
        lastMessage: lastMsg ? (lastMsg.type === 'image' ? '[图片]' : lastMsg.content) : '暂无消息',
        time: lastMsg ? lastMsg.createdAt : null, 
        rawTime: lastMsg ? new Date(lastMsg.createdAt) : new Date(0) // Sort to bottom if no msg
      });
    }

    // Sort by time desc
    chatList.sort((a, b) => b.rawTime - a.rawTime);

    res.json(chatList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get message history for a room
router.get('/history/:roomId', verify, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const messages = await Message.find({ room: roomId })
      .sort({ createdAt: 1 })
      .populate('sender', 'username');

    const payload = messages.map(m => ({
      room: m.room,
      sender: m.sender && m.sender.username ? m.sender.username : '未知用户',
      senderId: m.sender && m.sender._id ? m.sender._id.toString() : undefined,
      content: m.content,
      type: m.type || 'text',
      timestamp: m.createdAt.toISOString()
    }));

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/unread', verify, async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId }).select('_id').lean();
    const user = await User.findById(userId).populate('friends', '_id').lean();
    const friends = user.friends || [];

    const rooms = [];
    for (let g of groups) rooms.push(g._id.toString());
    for (let f of friends) rooms.push([userId, f._id.toString()].sort().join('_'));

    const result = {};
    for (let room of rooms) {
      const rs = await ReadState.findOne({ user: userId, room }).lean();
      const since = rs ? rs.lastReadAt : new Date(0);
      const count = await Message.countDocuments({ room, createdAt: { $gt: since } });
      if (count > 0) result[room] = count;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/read/:roomId', verify, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    await ReadState.findOneAndUpdate(
      { user: req.user._id, room: roomId },
      { $set: { lastReadAt: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
