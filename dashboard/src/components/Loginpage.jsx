import { useState } from "react";
import { AtSign, Lock, Eye, EyeOff, ArrowRight, CircleDot } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: connect to your auth/MQTT backend
    console.log("Signing in with:", { email, password });
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome Back
        </h1>
        <p className="text-slate-500 mb-8">
          Access your parking operator dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Email Address
            </label>
            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.rivera@parkpulse.ai"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-800">
                Password
              </label>
              <button
                type="button"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-11 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            Sign In
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-semibold tracking-wider text-slate-400">
            OR CONTINUE WITH
          </span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Social buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-3 hover:bg-slate-50 transition-colors">
            <span className="w-5 h-5 rounded-sm bg-slate-900 flex items-center justify-center text-[10px] text-white font-bold">
              G
            </span>
            <span className="text-sm font-medium text-slate-800">Google</span>
          </button>
          <button className="flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-3 hover:bg-slate-50 transition-colors">
            <span className="w-5 h-5 rounded-sm bg-slate-900 flex items-center justify-center text-[10px] text-white">
              
            </span>
            <span className="text-sm font-medium text-slate-800">Apple</span>
          </button>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-slate-600 mt-7">
          New to the platform?{" "}
          <button className="font-bold text-slate-900 hover:underline">
            Request operator access
          </button>
        </p>
      </div>

      {/* Page footer */}
      <div className="w-full max-w-md mt-10 flex items-start justify-between text-xs text-slate-400">
        <span className="font-semibold">
          © 2024 ParkPulse AI Technologies
        </span>
        <div className="flex gap-4">
          <button className="hover:text-slate-600">Privacy Policy</button>
          <button className="hover:text-slate-600">Service Terms</button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-4 py-1.5">
        <CircleDot className="w-3 h-3 text-green-500" />
        All Systems Operational (v4.2.1-stable)
      </div>
    </div>
  );
}
