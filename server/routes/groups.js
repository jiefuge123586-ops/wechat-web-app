const router = require('express').Router();
const Group = require('../models/Group');
const User = require('../models/User');
const Message = require('../models/Message');
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

// Create Group
router.post('/', verify, async (req, res) => {
  try {
    const { name, notice, members, avatar } = req.body; // members is array of userIds
    
    // Add creator to members
    const allMembers = [...new Set([...members, req.user._id])];

    const newGroup = new Group({
      name,
      notice,
      avatar: avatar || '',
      owner: req.user._id,
      admins: [req.user._id],
      members: allMembers
    });

    const savedGroup = await newGroup.save();
    res.json(savedGroup);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get User's Groups
router.get('/', verify, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get Group Details
router.get('/:id', verify, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'username nickname avatar');
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Group
router.put('/:id', verify, async (req, res) => {
  try {
    const { name, notice, avatar } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ message: "群组不存在" });
    // Check permission (owner or admin)
    const isAdmin = group.admins.map(a => a.toString()).includes(req.user._id);
    const isOwner = group.owner.toString() === req.user._id;
    if (!isAdmin && !isOwner) return res.status(403).json({ message: "无权修改" });

    if (name) group.name = name;
    if (notice) group.notice = notice;
    if (avatar) group.avatar = avatar;

    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Leave Group (member self leave)
router.delete('/:id/leave', verify, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "群组不存在" });
    // Owner cannot leave
    if (group.owner.toString() === req.user._id) {
      return res.status(400).json({ message: "群主不可退群" });
    }
    // If not a member, nothing to do
    const wasMember = group.members.map(m => m.toString()).includes(req.user._id);
    if (!wasMember) return res.json(group);

    group.members = group.members.filter(m => m.toString() !== req.user._id);
    group.admins = group.admins.filter(a => a.toString() !== req.user._id);
    await group.save();

    // System message and notifications
    const io = global._io;
    try {
      const actor = await User.findById(req.user._id).select('username');
      const content = `${actor.username} 退出了群聊`;
      const saved = await new Message({ room: group._id.toString(), content, sender: actor._id, type: 'system', createdAt: new Date() }).save();
      if (io) {
        io.to(group._id.toString()).emit('receive_message', { room: group._id.toString(), sender: actor.username, content, type: 'system', timestamp: saved.createdAt.toISOString() });
      }
    } catch (e) {}

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add Members
router.post('/:id/members', verify, async (req, res) => {
  try {
    const { newMembers } = req.body; // array of userIds
    const group = await Group.findById(req.params.id);

    if (!group) return res.status(404).json({ message: "群组不存在" });
    // Permission: owner or admin
    if (!group.admins.map(a => a.toString()).includes(req.user._id) && group.owner.toString() !== req.user._id) {
      return res.status(403).json({ message: "无权修改" });
    }

    group.members = [...new Set([...group.members, ...newMembers])];
    await group.save();
    // System message and notifications
    const io = global._io;
    try {
      const actor = await User.findById(req.user._id).select('username');
      const addedUsers = await User.find({ _id: { $in: newMembers } }).select('username');
      const names = addedUsers.map(u => u.username).join('、');
      const content = `${actor.username} 邀请 ${names} 加入群聊`;
      const saved = await new Message({ room: group._id.toString(), content, sender: actor._id, type: 'system', createdAt: new Date() }).save();

      if (io) {
        // notify new members with invite event
        for (const uid of newMembers) {
          io.to(`user:${uid}`).emit('group_invite', { groupId: group._id.toString(), groupName: group.name, timestamp: saved.createdAt.toISOString() });
        }
        // broadcast system message to group room
        io.to(group._id.toString()).emit('receive_message', { room: group._id.toString(), sender: actor.username, content, type: 'system', timestamp: saved.createdAt.toISOString() });
      }
    } catch (e) {
      // silent
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove Member (kick)
router.delete('/:id/members/:memberId', verify, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "群组不存在" });

    // Permission: owner or admin
    if (!group.admins.map(a => a.toString()).includes(req.user._id) && group.owner.toString() !== req.user._id) {
      return res.status(403).json({ message: "无权修改" });
    }

    const memberId = req.params.memberId;
    group.members = group.members.filter(m => m.toString() !== memberId);
    // also revoke admin if applicable
    group.admins = group.admins.filter(a => a.toString() !== memberId);
    await group.save();

    // System message and notifications
    const io = global._io;
    try {
      const actor = await User.findById(req.user._id).select('username');
      const kickedUser = await User.findById(memberId).select('username');
      const content = `${actor.username} 将 ${kickedUser.username} 移出群聊`;
      const saved = await new Message({ room: group._id.toString(), content, sender: actor._id, type: 'system', createdAt: new Date() }).save();
      if (io) {
        io.to(`user:${memberId}`).emit('group_removed', { groupId: group._id.toString(), groupName: group.name, timestamp: saved.createdAt.toISOString() });
        io.to(group._id.toString()).emit('receive_message', { room: group._id.toString(), sender: actor.username, content, type: 'system', timestamp: saved.createdAt.toISOString() });
      }
    } catch (e) {}

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Set Admin (owner only)
router.post('/:id/admins', verify, async (req, res) => {
  try {
    const { memberId } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "群组不存在" });
    if (group.owner.toString() !== req.user._id) return res.status(403).json({ message: "无权设置管理员" });

    group.admins = [...new Set([...group.admins, memberId])];
    await group.save();

    const io = global._io;
    try {
      const actor = await User.findById(req.user._id).select('username');
      const target = await User.findById(memberId).select('username');
      const content = `${actor.username} 将 ${target.username} 设为管理员`;
      const saved = await new Message({ room: group._id.toString(), content, sender: actor._id, type: 'system', createdAt: new Date() }).save();
      if (io) {
        io.to(`user:${memberId}`).emit('group_admin_set', { groupId: group._id.toString(), groupName: group.name, timestamp: saved.createdAt.toISOString() });
        io.to(group._id.toString()).emit('receive_message', { room: group._id.toString(), sender: actor.username, content, type: 'system', timestamp: saved.createdAt.toISOString() });
      }
    } catch (e) {}

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Unset Admin (owner only)
router.delete('/:id/admins/:memberId', verify, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "群组不存在" });
    if (group.owner.toString() !== req.user._id) return res.status(403).json({ message: "无权撤销管理员" });

    const memberId = req.params.memberId;
    group.admins = group.admins.filter(a => a.toString() !== memberId);
    await group.save();

    const io = global._io;
    try {
      const actor = await User.findById(req.user._id).select('username');
      const target = await User.findById(memberId).select('username');
      const content = `${actor.username} 撤销 ${target.username} 的管理员`;
      const saved = await new Message({ room: group._id.toString(), content, sender: actor._id, type: 'system', createdAt: new Date() }).save();
      if (io) {
        io.to(`user:${memberId}`).emit('group_admin_unset', { groupId: group._id.toString(), groupName: group.name, timestamp: saved.createdAt.toISOString() });
        io.to(group._id.toString()).emit('receive_message', { room: group._id.toString(), sender: actor.username, content, type: 'system', timestamp: saved.createdAt.toISOString() });
      }
    } catch (e) {}

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
