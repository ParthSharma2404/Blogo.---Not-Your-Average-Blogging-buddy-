// import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const validationSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(validationSchema),
  });
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    try {
      if (!auth) {
        alert("Firebase not initialized. Check .env.local and restart the dev server.");
        return;
      }
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      const token = await user.getIdToken();
      localStorage.setItem("token", token);
      localStorage.setItem("username", user.displayName || user.email);
      localStorage.setItem("userId", user.uid);
      navigate("/dashboard");
    } catch (error) {
      const msg = error?.code ? `${error.code}: ${error.message}` : error.message;
      alert("Login failed: " + msg);
    }
  };

  return (
    <div className="min-h-screen content-center">
      <h1 className="font-extrabold text-5xl text-center">LogIn</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="text-center mt-10 mb-2">
        <input
          type="email"
          placeholder="Email"
          {...register("email")}
          className="outline outline-2 text-2xl rounded-xl pl-3 py-2 mb-5 focus:outline-green-400 dark:text-black"
        /><br />
        {errors.email && <p style={{ color: "red" }}>{errors.email.message}</p>}
        <input
          type="password"
          placeholder="Password"
          {...register("password")}
          className="outline outline-2 text-2xl rounded-xl pl-3 py-2 mb-5 focus:outline-green-400 dark:text-black"
        /><br />
        {errors.password && <p style={{ color: "red" }}>{errors.password.message}</p>}
        <input
          type="submit"
          value="Login"
          className="font-medium text-2xl outline outline-2 px-4 py-2 rounded-xl hover:bg-green-400 hover:text-white hover:duration-300"
        />
      </form>
      <div className="text-center">
        <Link to="/register" className="text-green-400 font-semibold text-xl">Register</Link>
      </div>
    </div>
  );
}

export default Login;