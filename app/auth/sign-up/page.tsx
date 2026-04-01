"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "teacher" | "parent";

export default function SignUpPage() {
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [classCode, setClassCode] = useState("");
  const [gradeOpen, setGradeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Check if email is valid for teacher role
  const isTeacherEmail = email.endsWith("@olula.edu.mn");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (password !== confirmPassword) {
      setError("Нууц үг таарахгүй байна");
      return;
    }
    if (password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгттэй байх ёстой");
      return;
    }
    if (role === "teacher" && !isTeacherEmail) {
      setError("Багш @olula.edu.mn имэйлтэй байх ёстой");
      return;
    }
    if (role === "student" && !grade) {
      setError("Анги сонгоно уу");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/auth/login`,
          data: {
            role,
            first_name: firstName,
            last_name: lastName,
            grade: role === "student" ? grade : null,
            class_code: role !== "teacher" ? classCode : null,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      router.push("/auth/sign-up-success");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message === "User already registered" 
          ? "Энэ и-мэйлээр бүртгэл үүссэн байна" 
          : err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const roles = [
    {
      value: "student" as Role,
      label: "Сурагч",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
        </svg>
      ),
    },
    {
      value: "teacher" as Role,
      label: "Багш",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ),
    },
    {
      value: "parent" as Role,
      label: "Эцэг эх",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-12 overflow-auto"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #f0fdfd 60%, #ffffff 100%)" }}
    >
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-xl p-10">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #4dd0e1 0%, #f97316 100%)" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Бүртгүүлэх</h2>
          <p className="text-center text-gray-400 text-base mb-6">Шинэ хаяг үүсгэнэ үү</p>

          {/* Role selector */}
          <p className="text-sm font-medium text-gray-600 mb-2">Дүр сонгох</p>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
            {roles.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setRole(r.value);
                  setError("");
                  setGrade(null);
                  setClassCode("");
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-base font-semibold transition-colors"
                style={
                  role === r.value
                    ? { background: "#06b6d4", color: "white" }
                    : { background: "white", color: "#6b7280" }
                }
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name fields */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Овог</label>
                <input
                  type="text"
                  placeholder="Овог"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400"
                  style={{ background: "#f3f4f6" }}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Нэр</label>
                <input
                  type="text"
                  placeholder="Нэр"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400"
                  style={{ background: "#f3f4f6" }}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">И-мэйл хаяг</label>
              <input
                type="email"
                placeholder={role === "teacher" ? "bagsh@olula.edu.mn" : "example@gmail.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400"
                style={{ background: "#f3f4f6" }}
                required
              />
              {role === "teacher" && (
                <p className="text-xs text-gray-400 mt-1">Багш @olula.edu.mn имэйлтэй байх ёстой</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Нууц үг</label>
              <input
                type="password"
                placeholder="Хамгийн багадаа 6 тэмдэгт"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400"
                style={{ background: "#f3f4f6" }}
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Нууц үг давтах</label>
              <input
                type="password"
                placeholder="Нууц үг давтах"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400"
                style={{ background: "#f3f4f6" }}
                required
              />
            </div>

            {/* Class Code — student & parent */}
            {(role === "student" || role === "parent") && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  {role === "parent" ? "Сурагчийн ангийн код" : "Ангийн код"}
                </label>
                <input
                  type="text"
                  placeholder="Ангийн код (жш: ABC123)"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl px-4 py-3 text-base text-gray-700 outline-none placeholder-gray-400 uppercase"
                  style={{ background: "#f3f4f6" }}
                />
              </div>
            )}

            {/* Grade — student only */}
            {role === "student" && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Анги</label>
                <button
                  type="button"
                  onClick={() => setGradeOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3"
                  style={{ background: "#f3f4f6" }}
                >
                  <span className={`text-base ${grade ? "text-gray-700 font-semibold" : "text-gray-400"}`}>
                    {grade ? `${grade}-р анги` : "Анги сонгох..."}
                  </span>
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="#9ca3af"
                    style={{ transform: gradeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </button>
                {gradeOpen && (
                  <div className="grid grid-cols-6 gap-2 mt-2">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => { setGrade(g); setGradeOpen(false); }}
                        className="py-2 rounded-lg text-base font-semibold transition-colors"
                        style={grade === g ? { background: "#06b6d4", color: "white" } : { background: "#f3f4f6", color: "#6b7280" }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-3 px-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold text-base transition-opacity hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ background: "#06b6d4" }}
            >
              {loading ? "Түр хүлээнэ үү..." : "Бүртгүүлэх"}
            </button>

            <p className="text-center text-gray-500 text-sm">
              Бүртгэлтэй юу?{" "}
              <Link href="/auth/login" className="font-semibold" style={{ color: "#06b6d4" }}>
                Нэвтрэх
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
