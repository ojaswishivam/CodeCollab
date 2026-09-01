import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Shield,
  Loader2,
} from "lucide-react";
import { API_URL } from "../config";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { displayName: string; email: string }, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const payload = isLogin
      ? { email, password }
      : { email, password, displayName };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      localStorage.setItem("collab_token", data.token);
      localStorage.setItem("collab_user", JSON.stringify(data.user));
      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoUser = () => {
    setIsLogin(true);
    setEmail("demo@codecollab.io");
    setPassword("password123");
    setError("");
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-down">
      <div className="bg-[#12121a] border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          title="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isLogin ? "Welcome to CodeCollab" : "Create Account"}
            </h2>
            <p className="text-xs text-gray-400">
              {isLogin
                ? "Sign in to save and access your collaborative workspaces"
                : "Register to manage persistent real-time coding sessions"}
            </p>
          </div>
        </div>

        {/* Demo Account Quick Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleFillDemoUser}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 border border-indigo-500/30 hover:border-indigo-400/60 text-xs font-semibold text-indigo-200 transition group shadow-sm"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" />
              <span>Fill Quick Demo Credentials</span>
            </span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
              demo@codecollab.io
            </span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {!isLogin && (
            <div>
              <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Display Name
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-2.5 text-gray-500" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-gray-700/80 text-sm text-white pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Alex Walker"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1a1a24] border border-gray-700/80 text-sm text-white pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1a24] border border-gray-700/80 text-sm text-white pl-9 pr-10 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition mt-2 shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? "Sign In to Workspace" : "Create Account"}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer toggle */}
        <div className="text-center mt-4 text-xs text-gray-400">
          {isLogin ? "Don't have an account yet? " : "Already registered? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline ml-1"
          >
            {isLogin ? "Create one now" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
