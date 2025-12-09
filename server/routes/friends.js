const router = require('express').Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const jwt = require('jsonwebtoken');

// Middleware to verify token
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

// Send Friend Request
router.post('/request', verify, async (req, res) => {
  try {
    const { toUserId, remark } = req.body;
    
    if (toUserId === req.user._id) return res.status(400).json({ message: "不能添加自己为好友" });

    // Check if already friends
    const currentUser = await User.findById(req.user._id);
    if (currentUser.friends.includes(toUserId)) {
      return res.status(400).json({ message: "已经是好友了" });
    }

    // Check if request already sent
    const existingRequest = await FriendRequest.findOne({
      from: req.user._id,
      to: toUserId,
      status: 'pending'
    });
    if (existingRequest) return res.status(400).json({ message: "已发送过请求" });

    const newRequest = new FriendRequest({
      from: req.user._id,
      to: toUserId,
      remark
    });

    await newRequest.save();
    // emit socket event to recipient
    try {
      const io = global._io;
      if (io) {
        const fromUser = await User.findById(req.user._id).select('username nickname avatar');
        io.to(`user:${toUserId}`).emit('friend_request', {
          id: newRequest._id,
          from: { _id: fromUser._id, username: fromUser.username, nickname: fromUser.nickname, avatar: fromUser.avatar },
          remark,
          createdAt: newRequest.createdAt.toISOString()
        });
      }
    } catch (e) {
      // silent
    }
    res.json({ message: "请求已发送" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Friend Requests (Received)
router.get('/requests', verify, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user._id, status: 'pending' })
      .populate('from', 'username nickname avatar');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Handle Request (Accept/Reject)
router.put('/request/:id', verify, async (req, res) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'
    const request = await FriendRequest.findById(req.params.id);

    if (!request) return res.status(404).json({ message: "请求不存在" });
    if (request.to.toString() !== req.user._id) return res.status(403).json({ message: "无权操作" });

    request.status = status;
    await request.save();

  if (status === 'accepted') {
    // Add to both users' friend lists
    await User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } });
    await User.findByIdAndUpdate(request.to, { $addToSet: { friends: request.from } });
  }

  // emit updates
  try {
    const io = global._io;
    if (io) {
      io.to(`user:${request.to}`).emit('friend_request_update', { id: request._id, status });
      if (status === 'accepted') {
        const toUser = await User.findById(request.to).select('username nickname avatar');
        io.to(`user:${request.from}`).emit('friend_request_accepted', {
          user: { _id: toUser._id, username: toUser.username, nickname: toUser.nickname, avatar: toUser.avatar },
          createdAt: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    // silent
  }

  res.json({ message: `已${status === 'accepted' ? '接受' : '拒绝'}请求` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Friends List
router.get('/', verify, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'username nickname avatar bio');
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
