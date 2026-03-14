const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { admin, firestore } = require('./firebaseAdmin');

// Load environment variables from .env file
require('dotenv').config();

// Fallback values if .env doesn't load (for development)
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://blogouser:user123@cluster0.kv26f.mongodb.net/blogodb?retryWrites=true&w=majority';
  console.log('⚠️  Using fallback MONGODB_URI - create a .env file for production');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
  console.log('⚠️  Using fallback JWT_SECRET - create a .env file for production');
}

console.log('=== ENVIRONMENT VARIABLES LOADED ===');

const app = express();

// Debug environment variables
console.log('Environment check:');
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT || 3001);

// Cached MongoDB Connection
let cachedDb = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  
  try {
    // Check if MONGODB_URI exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB Atlas...');
    
    cachedDb = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ Successfully connected to MongoDB Atlas');
    return cachedDb;
  } catch (error) {
    console.error('❌ MongoDB Atlas connection error:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    // Common error codes and solutions
    if (error.message.includes('authentication failed')) {
      console.error('💡 Solution: Check your username/password in MONGODB_URI');
    } else if (error.message.includes('not authorized')) {
      console.error('💡 Solution: Whitelist your IP address in MongoDB Atlas');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('💡 Solution: Check your cluster URL in MONGODB_URI');
    }
    
    process.exit(1);
  }
}

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// Firestore health check
app.get('/api/firestore/health', async (req, res) => {
  try {
    if (!firestore) {
      return res.status(500).json({ status: 'uninitialized', error: 'Missing Firebase Admin env vars' });
    }
    const snap = await firestore.collection('blogs').limit(1).get();
    res.json({ status: 'healthy', checkedCount: snap.size, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Models - Use the external model files if possible, or define correctly here.
// For now, ensuring consistency with the external User.js
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String }, 
  firebaseUid: { type: String, unique: true },
});
const User = mongoose.model('User', userSchema);


const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});
const Blog = mongoose.model('Blog', blogSchema);

// Routes
// Routes - Define them directly here (working approach)
// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Registration route
app.post('/api/auth/register', async (req, res) => {
  try {
    await connectDB();
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Middleware to verify Firebase ID token and sync user
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    let uid, email, name;
    if (admin) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      uid = decodedToken.uid;
      email = decodedToken.email;
      name = decodedToken.name || email.split('@')[0];
    } else {
      console.warn('⚠️ Firebase Admin not initialized. Using insecure decoding for development.');
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
      uid = payload.user_id || payload.uid;
      email = payload.email;
      name = payload.name || (email ? email.split('@')[0] : 'User');
    }

    await connectDB();
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      // Create user if they don't exist in MongoDB yet
      user = new User({
        firebaseUid: uid,
        email: email,
        username: name
      });
      await user.save();
    }
    
    req.mongoUserId = user._id;
    req.userId = uid;
    next();
  } catch (err) {
    console.error('Token verification/sync error:', err);
    return res.status(401).json({ error: 'Invalid token: ' + err.message });
  }
};



// Blog routes
app.post('/api/blogs', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const blog = new Blog({
      title,
      content,
      author: req.mongoUserId
    });
    
    await blog.save();
    res.status(201).json({ message: 'Blog created successfully', blog });
  } catch (err) {
    console.error('Blog creation error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Get user's own blogs (for dashboard)
app.get('/api/blogs', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const blogs = await Blog.find({ author: req.mongoUserId }).populate('author', 'username').sort({ timestamp: -1 });
    // Transform to match Firestore-like structure for frontend (date handling)
    const formattedBlogs = blogs.map(blog => ({
      _id: blog._id,
      title: blog.title,
      content: blog.content,
      authorName: blog.author ? blog.author.username : 'You',
      createdAt: blog.timestamp.toISOString()
    }));
    res.json(formattedBlogs);

  } catch (err) {
    console.error('Blogs fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Delete blog
app.delete('/api/blogs/:id', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const blog = await Blog.findOne({ _id: req.params.id, author: req.mongoUserId });
    
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found or not authorized' });
    }
    
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog deleted successfully' });
  } catch (err) {
    console.error('Blog deletion error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/blogs/all', async (req, res) => {
  try {
    await connectDB();
    // Fetch all blogs from MongoDB instead of Firestore for unification
    const blogs = await Blog.find().populate('author', 'username email').sort({ timestamp: -1 });
    // Transform to match the expected frontend format if necessary
    const formattedBlogs = blogs.map(blog => ({
      id: blog._id,
      title: blog.title,
      content: blog.content,
      authorName: blog.author ? blog.author.username : 'Unknown Author',
      createdAt: blog.timestamp.toISOString()
    }));

    res.json(formattedBlogs);
  } catch (err) {
    console.error('Blogs fetch error (MongoDB):', err);
    res.status(500).json({ error: err.message });
  }
});


// Keep original blogs endpoint for compatibility
app.get('/api/blogs', async (req, res) => {
  try {
    await connectDB();
    const blogs = await Blog.find().populate('author', 'username').sort({ timestamp: -1 });
    res.json(blogs);
  } catch (err) {
    console.error('Blogs fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug route to see all databases and collections
app.get('/api/debug', async (req, res) => {
  try {
    await connectDB();
    
    // List all collections in current database
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    // Get stats about current database
    const dbStats = await mongoose.connection.db.stats();
    
    // Try to get all documents from blogs collection
    const allBlogs = await mongoose.connection.db.collection('blogs').find({}).toArray();
    
    res.json({
      currentDatabase: mongoose.connection.name,
      collections: collections.map(col => col.name),
      dbStats: {
        collections: dbStats.collections,
        objects: dbStats.objects,
        dataSize: dbStats.dataSize
      },
      blogsInCollection: allBlogs
    });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Seed Data (Optional, for testing)
app.get('/api/seed', async (req, res) => {
  try {
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    if (existingUser) {
      return res.json({ message: 'Test data already exists' });
    }
    
    const user = new User({ 
      email: 'test@example.com', 
      username: 'testuser', 
      password: await bcrypt.hash('password123', 10) 
    });
    await user.save();
    
    const blog = new Blog({ 
      title: 'Sample Blog', 
      content: 'This is a test blog post to verify the connection is working.', 
      author: user._id 
    });
    await blog.save();
    
    res.json({ message: 'Seeded data successfully', user: user.username });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌱 Seed data: http://localhost:${PORT}/api/seed`);
});