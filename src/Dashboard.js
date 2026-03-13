import React, { useState, useEffect } from "react";
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import axios from "axios";


const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

function Dashboard() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [blogs, setBlogs] = useState([]);
  const displayName = (auth && auth.currentUser && auth.currentUser.displayName) || localStorage.getItem("username") || "Guest";
  
  const fetchBlogs = async () => {
    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();
      const response = await axios.get(`${API_URL}/blogs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlogs(response.data);
    } catch (err) {
      console.error("Error fetching blogs:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !content) return alert("All fields are required");

    try {
      if (!auth.currentUser) return alert("You must be logged in to publish a blog.");
      const token = await auth.currentUser.getIdToken();
      await axios.post(`${API_URL}/blogs`, { title, content }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTitle("");
      setContent("");
      fetchBlogs();
    } catch (err) {
      alert("Error adding blog: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this blog?");
    if (!confirmDelete) return;

    try {
      if (!auth.currentUser) return alert("You must be logged in.");
      const token = await auth.currentUser.getIdToken();
      await axios.delete(`${API_URL}/blogs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBlogs();
    } catch (err) {
      alert("Error deleting blog: " + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchBlogs();
      } else {
        setBlogs([]);
      }
    });
    return () => unsubscribe();
  }, []);

 
  
  return (
    <div className="mx-4 sm:mx-8 md:mx-16 lg:mx-32 py-10 text-lg">
      <div className="text-2xl sm:text-3xl font-semibold">Welcome <span className="text-green-500">{displayName}</span> to your Dashboard!</div>
      <p className="mt-3 text-gray-600 dark:text-gray-300">Here you can write and manage your blogs.</p>

      <div className="h-px bg-gray-400 my-8"></div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter blog title"
          className="w-full text-xl sm:text-2xl rounded-lg px-3 py-2 border dark:text-black focus:outline focus:outline-green-400"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your blog content here..."
          className="w-full h-40 text-base sm:text-xl p-3 rounded-lg border dark:text-green-400 focus:outline focus:outline-green-400"
        />
        <button
          type="submit"
          className="w-full sm:w-auto px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200"
        >
          Publish Blog
        </button>
      </form>

      <div className="mt-12">
        <h2 className="text-xl sm:text-3xl font-bold mb-6 text-center border py-3 px-4 border-green-400 rounded-xl">Your Blogs</h2>
        {blogs.length === 0 ? (
          <p className="text-center text-gray-500 text-xl">No blogs yet...</p>
        ) : (
          <div className="space-y-6">
            {blogs.map((blog) => (
              <div
                key={blog._id || blog.id}
                className="p-4 sm:p-6 border rounded-xl shadow-sm bg-white dark:bg-[#2a3a43]"
              >
                <h3 className="text-xl sm:text-2xl font-bold text-green-700 dark:text-white">{blog.title}</h3>
                <p className="mt-2 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{blog.content}</p>
                <p className="mt-2 text-gray-500 text-sm">
                  Published on {new Date(blog.createdAt).toLocaleDateString()}
                </p>
                <div className="text-right mt-4">
                  <button
                    onClick={() => handleDelete(blog._id || blog.id)}
                    className="px-4 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;