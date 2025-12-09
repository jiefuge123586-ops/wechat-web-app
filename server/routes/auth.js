const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: '用户名已存在' });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({
      username,
      password: hashedPassword
    });

    const savedUser = await newUser.save();
    res.status(201).json({ 
      _id: savedUser._id, 
      username: savedUser.username 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // Login
  router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check user
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: '用户不存在' });

    // Check password
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ message: '密码错误' });

    // Create token
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'secretKey');
    res.header('auth-token', token).json({ 
      token, 
      user: { _id: user._id, username: user.username, avatar: user.avatar } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
