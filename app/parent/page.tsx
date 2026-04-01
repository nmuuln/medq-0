"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  grade: number | null;
  class_code: string | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  points: number;
  grade: number;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  score: number | null;
}

export default function ParentDashboard() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Data
  const [students, setStudents] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Load user
  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profile || profile.role !== "parent") {
        router.push("/auth/login");
        return;
      }

      setUser(profile);
      setLoading(false);
    }
    loadUser();
  }, [router, supabase]);

  // Load students with same class code
  useEffect(() => {
    if (!user?.class_code) return;

    async function loadData() {
      // Get students with same class code
      const { data: studentsData } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .eq("class_code", user.class_code);

      setStudents(studentsData || []);

      // If students exist, select first one by default
      if (studentsData && studentsData.length > 0) {
        setSelectedStudent(studentsData[0].id);
      }
    }

    loadData();
  }, [user, supabase]);

  // Load assignments and submissions for selected student
  useEffect(() => {
    if (!selectedStudent) return;

    async function loadStudentData() {
      const student = students.find(s => s.id === selectedStudent);
      if (!student?.grade) return;

      // Get assignments for student's grade
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*")
        .eq("grade", student.grade);

      // Get student's submissions
      const { data: submissionsData } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", selectedStudent);

      setAssignments(assignmentsData || []);
      setSubmissions(submissionsData || []);
    }

    loadStudentData();
  }, [selectedStudent, students, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function fmtDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("mn-MN", {
      month: "short",
      day: "numeric"
    });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <p className="text-gray-500">Ачааллаж байна...</p>
      </div>
    );
  }

  const displayName = user.last_name && user.first_name
    ? `${user.last_name} ${user.first_name}`
    : user.email.split("@")[0];

  const currentStudent = students.find(s => s.id === selectedStudent);
  const completedAssignments = assignments.filter(a => submissions.some(s => s.assignment_id === a.id));
  const gradedSubmissions = submissions.filter(s => s.score !== null);
  const avgScore = gradedSubmissions.length
    ? Math.round(gradedSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / gradedSubmissions.length)
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f0fdfd" }}>
      {/* Header */}
      <div className="bg-white shadow-sm px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #4dd0e1, #f97316)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-lg">Анги платформ</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">{displayName}</span>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-500 hover:text-red-500 transition-colors px-4 py-2 rounded-lg hover:bg-red-50"
          >
            Гарах
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-8 py-8 max-w-6xl mx-auto w-full">
        {/* Banner */}
        <div
          className="rounded-3xl p-8 mb-8 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)" }}
        >
          <div>
            <p className="text-orange-100 text-sm mb-1">Тавтай морилно уу</p>
            <h1 className="text-white text-3xl font-black mb-1">{displayName}</h1>
            <p className="text-orange-200 text-sm">Эцэг эхийн хяналтын самбар</p>
          </div>
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </div>
        </div>

        {/* Student selector */}
        {students.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-4">Сурагч сонгох</h2>
            <div className="flex gap-3 flex-wrap">
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s.id)}
                  className="px-5 py-3 rounded-xl font-semibold transition-colors"
                  style={{
                    background: selectedStudent === s.id ? "#f97316" : "#f3f4f6",
                    color: selectedStudent === s.id ? "white" : "#374151"
                  }}
                >
                  {s.last_name} {s.first_name} ({s.grade}-р анги)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {currentStudent && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Нийт даалгавар</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Илгээсэн</p>
                <p className="text-2xl font-bold text-green-600">{completedAssignments.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Хүлээгдэж буй</p>
                <p className="text-2xl font-bold text-orange-500">{assignments.length - completedAssignments.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Дундаж оноо</p>
                <p className="text-2xl font-bold" style={{ color: avgScore && avgScore >= 80 ? "#10b981" : avgScore && avgScore >= 50 ? "#f97316" : "#6b7280" }}>
                  {avgScore !== null ? `${avgScore}%` : "—"}
                </p>
              </div>
            </div>

            {/* Assignments list */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Даалгаврын жагсаалт</h2>
              {assignments.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Даалгавар байхгүй</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {assignments.map(a => {
                    const submission = submissions.find(s => s.assignment_id === a.id);
                    return (
                      <div key={a.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#f8fafc" }}>
                        <div>
                          <p className="font-semibold text-gray-900">{a.title}</p>
                          <p className="text-sm text-gray-400">Хугацаа: {fmtDate(a.deadline)} | {a.points} оноо</p>
                        </div>
                        <div>
                          {submission ? (
                            submission.score !== null ? (
                              <span className="px-4 py-2 rounded-lg font-bold" style={{
                                background: submission.score >= 80 ? "#dcfce7" : submission.score >= 50 ? "#fff3e0" : "#fee2e2",
                                color: submission.score >= 80 ? "#16a34a" : submission.score >= 50 ? "#f97316" : "#ef4444"
                              }}>
                                {submission.score}%
                              </span>
                            ) : (
                              <span className="px-4 py-2 rounded-lg bg-cyan-100 text-cyan-700 font-semibold">Илгээсэн</span>
                            )
                          ) : (
                            <span className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 font-semibold">Илгээгээгүй</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {students.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <p className="text-gray-400">Таны ангийн кодтой таарах сурагч олдсонгүй.</p>
            <p className="text-gray-400 text-sm mt-2">Ангийн код: {user.class_code || "байхгүй"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
