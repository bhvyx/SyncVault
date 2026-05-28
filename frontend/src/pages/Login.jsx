import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import api from "../services/api";

function Login() {
  const navigate = useNavigate();

  localStorage.removeItem("token");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await api.post("/auth/login", {
        username,
        password,
      });

      localStorage.setItem("token", response.data.token);

      navigate("/dashboard");
    } catch (err) {
      console.error(err);

      alert("Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl p-10 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
        <div className="text-center mb-8">
          <h1 className="text-white text-5xl font-bold tracking-tight">
            SyncVault
          </h1>

          <p className="text-gray-400 mt-3 text-sm">
            Secure distributed file storage
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-gray-300 text-sm mb-2">Username</label>

            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              className="w-full bg-[#0d1117] text-white placeholder-gray-500 border border-[#30363d] rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm mb-2">Password</label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              className="w-full bg-[#0d1117] text-white placeholder-gray-500 border border-[#30363d] rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition duration-200 cursor-pointer"
          >
            Login
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-blue-400 hover:text-blue-300">
            Signup
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
