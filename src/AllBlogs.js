import React, { useState, useEffect } from 'react';
import axios from 'axios';


const API_URL = process.env.REACT_APP_API_URL || "/api";

function AllBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllBlogs = async () => {
      try {
        const response = await axios.get(`${API_URL}/blogs/all`);
        setBlogs(response.data);
      } catch (err) {
        console.error('Error fetching all blogs:', err);
        // alert('Error loading blogs: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchAllBlogs();
  }, []);


  if (loading) {
    return <div className="text-center text-xl py-10">Loading blogs...</div>;
  }


  return (
    <div className="mx-4 sm:mx-8 md:mx-16 lg:mx-32 py-10 text-lg">
      <h2 className="text-3xl font-bold mb-6 text-center border py-3 px-4 border-green-400 rounded-xl">All Blogs</h2>
      {blogs.length === 0 ? (
        <p className="text-center text-gray-500 text-xl">No blogs available yet...</p>
      ) : (
        <div className="space-y-6">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              className="p-4 sm:p-6 border rounded-xl shadow-sm bg-white dark:bg-[#2a3a43]"
            >
              <h3 className="text-2xl font-bold text-green-700 dark:text-white">{blog.title}</h3>
              <p className="mt-2 text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{blog.content}</p>
              <p className="mt-2 text-gray-500 text-sm">
                By {blog.authorName || 'Unknown Author'} on {
                  blog.createdAt?.toDate 
                    ? blog.createdAt.toDate().toLocaleDateString() 
                    : blog.createdAt 
                      ? new Date(blog.createdAt).toLocaleDateString() 
                      : 'Unknown Date'
                }
              </p>

            </div>

          ))}
        </div>
      )}
    </div>
  );
}

export default AllBlogs;