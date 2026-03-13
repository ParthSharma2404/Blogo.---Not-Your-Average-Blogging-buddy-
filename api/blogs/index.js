const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// MongoDB connection
let cachedDb = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  try {
    cachedDb = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    return cachedDb;
  } catch (error) {
    throw new Error('Database connection failed');
  }
}

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});
const Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);

// Middleware to verify JWT token
const verifyToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (err) {
    throw new Error('Invalid token');
  }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectDB();

    if (req.method === 'GET') {
      // Get user's own blogs (requires authentication)
      const userId = verifyToken(req);
      const blogs = await Blog.find({ author: userId }).populate('author', 'username').sort({ timestamp: -1 });
      res.json(blogs);
    } 
    else if (req.method === 'POST') {
      // Create new blog (requires authentication)
      const userId = verifyToken(req);
      const { title, content } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }
      
      const blog = new Blog({
        title,
        content,
        author: userId
      });
      
      await blog.save();
      res.status(201).json({ message: 'Blog created successfully', blog });
    }
    else if (req.method === 'DELETE') {
      // Delete blog (requires authentication)
      const userId = verifyToken(req);
      const blogId = req.query.id;
      
      if (!blogId) {
        return res.status(400).json({ error: 'Blog ID is required' });
      }
      
      const blog = await Blog.findOne({ _id: blogId, author: userId });
      
      if (!blog) {
        return res.status(404).json({ error: 'Blog not found or not authorized' });
      }
      
      await Blog.findByIdAndDelete(blogId);
      res.json({ message: 'Blog deleted successfully' });
    }
    else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    if (err.message === 'No token provided' || err.message === 'Invalid token') {
      return res.status(401).json({ error: err.message });
    }
    console.error('Blog API error:', err);
    res.status(500).json({ error: err.message });
  }
}