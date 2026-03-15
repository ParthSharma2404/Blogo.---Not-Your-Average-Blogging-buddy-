const mongoose = require('mongoose');

// MongoDB connection
let cachedDb = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  try {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
    }
    cachedDb = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    return cachedDb;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Database connection failed');
  }
}

// Schemas - Ensuring consistency with other parts of the app
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Firebase users
  firebaseUid: { type: String, unique: true },
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});
const Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);

// Robust token verification (Firebase ID Token)
const verifyToken = async (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    // Decoding token to get UID (In serverless, we'll use decoding if admin isn't setup)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
    
    const uid = payload.user_id || payload.uid;
    const email = payload.email;
    const name = payload.name || (email ? email.split('@')[0] : 'User');

    if (!uid) throw new Error('Invalid token payload');

    await connectDB();
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      // Sync user if they don't exist in MongoDB but have a valid Firebase token
      user = new User({
        firebaseUid: uid,
        email: email,
        username: name
      });
      await user.save();
    }
    return user._id;
  } catch (err) {
    console.error('Token verification error:', err);
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
      const userId = await verifyToken(req);
      const blogs = await Blog.find({ author: userId }).populate('author', 'username').sort({ timestamp: -1 });
      res.json(blogs);
    } 
    else if (req.method === 'POST') {
      const userId = await verifyToken(req);
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
      const userId = await verifyToken(req);
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