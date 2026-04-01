"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (data.user) {
        // Get user profile to determine role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profile?.role === "teacher") {
          router.push("/teacher");
        } else if (profile?.role === "parent") {
          router.push("/parent");
        } else {
          router.push("/student");
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message === "Invalid login credentials" 
          ? "И-мэйл эсвэл нууц үг буруу байна" 
          : err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0fdfd 60%, #ffffff 100%)" }}
    >
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center lg:items-stretch gap-12 lg:gap-20">
        {/* Left — Branding */}
        <div className="flex flex-col items-center lg:items-start justify-center lg:flex-1">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
            style={{ background: "linear-gradient(135deg, #4dd0e1 0%, #f97316 100%)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
            </svg>
          </div>

          <h1 className="text-5xl lg:text-6xl font-black text-gray-900 mb-4 text-center lg:text-left leading-tight">
            Анги платформ<span style={{ color: "#06b6d4" }}>.</span>
          </h1>
          <p className="text-gray-500 text-xl lg:text-2xl mb-10 max-w-sm text-center lg:text-left leading-relaxed">
            Багш сурагчийн харилцаа холбоог хялбаршуулсан орчин үеийн сургалтын систем
          </p>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            {[
              {
                bg: "#fce4ec", fill: "#e91e63",
                icon: <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />,
                title: "Даалгавар илгээх", sub: "Цаг алдалгүй даалгавар оноох, илгээх",
              },
              {
                bg: "#e8eaf6", fill: "#7986cb",
                icon: <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />,
                title: "Шууд мессеж", sub: "Багш сурагч хоорондоо шууд харилцах",
              },
              {
                bg: "#fff8e1", fill: "#fbc02d",
                icon: <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
                title: "Үнэлгээ өгөх", sub: "Ажлыг үнэлж, сэтгэгдэл үлдээх",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl px-7 py-6 flex items-center gap-5 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.bg }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill={f.fill}>{f.icon}</svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xl">{f.title}</p>
                  <p className="text-gray-400 text-base">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex items-center justify-center w-full lg:w-auto">
          <div className="bg-white rounded-3xl shadow-xl p-12" style={{ width: "500px", maxWidth: "100%" }}>
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-2">Нэвтрэх</h2>
            <p className="text-center text-gray-400 text-lg mb-8">И-мэйл, нууц үгээрээ нэвтрэнэ үү</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Email */}
              <div>
                <label className="block text-base font-medium text-gray-600 mb-2">И-мэйл хаяг</label>
                <div className="flex items-center gap-3 rounded-xl px-5 py-4" style={{ background: "#f3f4f6" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ca3af">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-transparent flex-1 text-lg text-gray-700 outline-none placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-base font-medium text-gray-600 mb-2">Нууц үг</label>
                <div className="flex items-center gap-3 rounded-xl px-5 py-4" style={{ background: "#f3f4f6" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#9ca3af">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                  <input
                    type="password"
                    placeholder="Нууц үг"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-transparent flex-1 text-lg text-gray-700 outline-none placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-base text-center bg-red-50 rounded-xl py-3 px-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 rounded-xl text-white font-bold text-lg transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "#06b6d4" }}
              >
                {loading ? "Түр хүлээнэ үү..." : "Нэвтрэх"}
              </button>

              <p className="text-center text-gray-500 text-base">
                Бүртгэлгүй юу?{" "}
                <Link href="/auth/sign-up" className="font-semibold" style={{ color: "#06b6d4" }}>
                  Бүртгүүлэх
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
