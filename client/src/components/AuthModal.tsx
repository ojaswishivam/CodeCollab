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
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { API_URL } from "../config";
import { UserProfile, UserRole } from "../types/codeclass";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const submitAuth = async (
    targetEmail: string,
    targetPassword: string,
    loginMode: boolean,
    targetName?: string,
    targetRole?: UserRole
  ) => {
    setError("");
    setLoading(true);

    const endpoint = loginMode ? "/api/auth/login" : "/api/auth/signup";
    const payload = loginMode
      ? { email: targetEmail, password: targetPassword }
      : { email: targetEmail, password: targetPassword, displayName: targetName, role: targetRole };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      sessionStorage.setItem("collab_token", data.token);
      sessionStorage.setItem("collab_user", JSON.stringify(data.user));
      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitAuth(email, password, isLogin, displayName, role);
  };

  const handleQuickDemo = async (demoEmail: string) => {
    setIsLogin(true);
    setEmail(demoEmail);
    setPassword("password123");
    await submitAuth(demoEmail, "password123", true);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-slide-down">
      <div className="bg-[#12121a] border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          title="Close Modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isLogin ? "Sign In to CodeClass" : "Create CodeClass Account"}
            </h2>
            <p className="text-xs text-gray-400">
              {isLogin
                ? "Role-based access for Students & Teachers"
                : "Register as a Student or Instructor"}
            </p>
          </div>
        </div>

        {/* Instant Role Demo Logins */}
        <div className="mb-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-400" />
            <span>One-Click Demo Accounts</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("teacher@codeclass.io")}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-purple-950/30 border border-purple-500/30 hover:border-purple-400 text-[11px] font-semibold text-purple-200 transition"
            >
              <BookOpen size={14} className="text-purple-400" />
              <span>Teacher</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("student1@codeclass.io")}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400 text-[11px] font-semibold text-indigo-200 transition"
            >
              <GraduationCap size={14} className="text-indigo-400" />
              <span>Student A</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo("student2@codeclass.io")}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400 text-[11px] font-semibold text-emerald-200 transition"
            >
              <GraduationCap size={14} className="text-emerald-400" />
              <span>Student B</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!isLogin && (
            <>
              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                  Account Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                      role === "student"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-[#1a1a24] border-gray-700 text-gray-400"
                    }`}
                  >
                    <GraduationCap size={14} />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("teacher")}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition ${
                      role === "teacher"
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "bg-[#1a1a24] border-gray-700 text-gray-400"
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>Teacher</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[#1a1a24] border border-gray-700/80 text-sm text-white pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Aarav Verma"
                  />
                </div>
              </div>
            </>
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
                placeholder="you@codeclass.io"
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
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition mt-1 shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{isLogin ? "Sign In" : "Create Account"}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-4 text-xs text-gray-400">
          {isLogin ? "New to CodeClass? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline ml-1"
          >
            {isLogin ? "Register here" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
