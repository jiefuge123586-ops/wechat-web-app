const router = require('express').Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Group = require('../models/Group');
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

// Search users
router.get('/search', verify, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { nickname: { $regex: query, $options: 'i' } }
      ]
    }).select('username nickname avatar bio');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get User Profile
router.get('/:id', verify, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Profile
router.put('/profile', verify, async (req, res) => {
  try {
    const { nickname, bio, avatar } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, {
      nickname, bio, avatar
    }, { new: true }).select('-password');
    // broadcast profile update to friends and group members
    try {
      const io = global._io;
      if (io) {
        const me = await User.findById(req.user._id).select('friends');
        const groups = await Group.find({ members: req.user._id }).select('members');
        const recipients = new Set();
        for (const fid of (me.friends || [])) recipients.add(fid.toString());
        for (const g of groups) {
          for (const mid of (g.members || [])) {
            const midStr = mid.toString();
            if (midStr !== req.user._id) recipients.add(midStr);
          }
        }
        const payload = { _id: user._id, username: user.username, nickname: user.nickname, avatar: user.avatar };
        for (const rid of recipients) io.to(`user:${rid}`).emit('user_profile_updated', payload);
      }
    } catch (e) {}
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
