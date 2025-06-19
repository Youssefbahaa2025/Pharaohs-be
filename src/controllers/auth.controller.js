const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  const { name, email, password, confirmPassword, role, date_of_birth } = req.body;

  if (!name || !email || !password || !role || !confirmPassword)
    return res.status(400).json({ message: 'All fields are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ message: 'Passwords do not match' });

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashed, role]
    );

    const userId = result.insertId;

    // Create player profile with date_of_birth if role is player
    if (role === 'player' && date_of_birth) {
      await db.query(
        'INSERT INTO player_profiles (user_id, date_of_birth) VALUES (?, ?)',
        [userId, date_of_birth]
      );
    }

    const user = {
      id: userId,
      name,
      email,
      role,
      createdAt: new Date()
    };

    const jwtConfig = require('../config/jwt');
    const token = jwt.sign(user, jwtConfig.secret, { expiresIn: jwtConfig.refreshToken.expiresIn });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check user status
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Sign token
    const jwtConfig = require('../config/jwt');
    const token = jwt.sign(
      { id: user.id, role: user.role },
      jwtConfig.secret,
      { expiresIn: jwtConfig.expiresIn, algorithm: 'HS256' }
    );

    // Return response with full user info
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at // Adjust if the DB column is named differently
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.profile = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const token = authHeader.split(' ')[1];
    const jwtConfig = require('../config/jwt');
    const decoded = jwt.verify(token, jwtConfig.secret, jwtConfig.verifyOptions);
    const [users] = await db.query('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);
    const user = users[0];
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};