"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  teacher_id: string;
  grade: number;
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  text: string | null;
  submitted_at: string;
  score: number | null;
  graded_at: string | null;
  student?: Profile;
}

interface Message {
  id: string;
  from_id: string;
  to_id: string | null;
  to_email: string | null;
  text: string;
  sent_at: string;
  sender?: Profile;
}

const NAV = [
  { key: "dashboard", label: "Хяналтын самбар", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> },
  { key: "assignments", label: "Даалгаврууд", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg> },
  { key: "students", label: "Сурагчид", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg> },
  { key: "chat", label: "Мессежүүд", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg> },
];

export default function TeacherDashboard() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const router = useRouter();
  const supabase = createClient();

  // Data
  const [students, setStudents] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Assignment form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", grade: "", deadline: "", points: 100 });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Selected assignment for submissions
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // Grade modal
  const [gradeTarget, setGradeTarget] = useState<Submission | null>(null);
  const [gradeInput, setGradeInput] = useState("");
  const [grading, setGrading] = useState(false);

  // Chat
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

      if (!profile || profile.role !== "teacher") {
        router.push("/auth/login");
        return;
      }

      setUser(profile);
      setLoading(false);
    }
    loadUser();
  }, [router, supabase]);

  // Load data
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      // Load students (all students in system)
      const { data: studentsData } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student");

      // Load teacher's assignments
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      // Load all submissions for teacher's assignments
      const assignmentIds = (assignmentsData || []).map(a => a.id);
      let submissionsData: Submission[] = [];
      if (assignmentIds.length > 0) {
        const { data } = await supabase
          .from("submissions")
          .select("*, student:profiles!student_id(*)")
          .in("assignment_id", assignmentIds);
        submissionsData = data || [];
      }

      // Load messages sent to this teacher (by email or id)
      const { data: messagesData } = await supabase
        .from("messages")
        .select("*, sender:profiles!from_id(*)")
        .or(`to_id.eq.${user.id},to_email.eq.${user.email}`)
        .order("sent_at", { ascending: false });

      setStudents(studentsData || []);
      setAssignments(assignmentsData || []);
      setSubmissions(submissionsData);
      setMessages(messagesData || []);
    }

    loadData();
  }, [user, supabase]);

  // Get conversations
  const conversations = messages.reduce((acc, msg) => {
    const senderId = msg.from_id;
    if (senderId === user?.id) return acc;
    if (!acc[senderId]) {
      acc[senderId] = {
        sender: msg.sender,
        messages: [],
        lastMessage: msg.sent_at
      };
    }
    acc[senderId].messages.push(msg);
    return acc;
  }, {} as Record<string, { sender?: Profile; messages: Message[]; lastMessage: string }>);

  // Get chat messages for selected conversation
  const loadChatMessages = useCallback(async () => {
    if (!user || !selectedChat) return;

    const { data } = await supabase
      .from("messages")
      .select("*, sender:profiles!from_id(*)")
      .or(`and(from_id.eq.${selectedChat},to_id.eq.${user.id}),and(from_id.eq.${user.id},to_id.eq.${selectedChat})`)
      .order("sent_at", { ascending: true });

    if (data) {
      // Update messages in conversations
      const chatMsgs = data as Message[];
      setMessages(prev => {
        const existing = prev.filter(m => 
          !(m.from_id === selectedChat && m.to_id === user.id) &&
          !(m.from_id === user.id && m.to_id === selectedChat)
        );
        return [...existing, ...chatMsgs];
      });
    }
  }, [user, selectedChat, supabase]);

  useEffect(() => {
    loadChatMessages();
  }, [loadChatMessages]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChat]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  function fmtDate(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("mn-MN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function relTime(dateStr: string | null) {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} минутын өмнө`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} цагийн өмнө`;
    return `${Math.floor(hours / 24)} өдрийн өмнө`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreateError("");
    setCreating(true);

    try {
      const { error } = await supabase
        .from("assignments")
        .insert({
          teacher_id: user.id,
          title: form.title,
          description: form.description || null,
          grade: parseInt(form.grade),
          deadline: form.deadline || null,
          points: form.points
        });

      if (error) throw error;

      // Reload assignments
      const { data } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      setAssignments(data || []);
      setShowCreate(false);
      setForm({ title: "", description: "", grade: "", deadline: "", points: 100 });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCreateError(err.message);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradeTarget) return;
    setGrading(true);

    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          score: parseInt(gradeInput),
          graded_at: new Date().toISOString()
        })
        .eq("id", gradeTarget.id);

      if (error) throw error;

      setSubmissions(prev => prev.map(s =>
        s.id === gradeTarget.id
          ? { ...s, score: parseInt(gradeInput), graded_at: new Date().toISOString() }
          : s
      ));
      setGradeTarget(null);
      setGradeInput("");
    } finally {
      setGrading(false);
    }
  }

  async function handleSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !user || !selectedChat) return;

    setChatSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          from_id: user.id,
          to_id: selectedChat,
          text: chatInput
        })
        .select("*, sender:profiles!from_id(*)")
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setChatInput("");
    } finally {
      setChatSending(false);
    }
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
  const initials = user.last_name && user.first_name
    ? (user.last_name[0] + user.first_name[0]).toUpperCase()
    : user.email[0].toUpperCase();

  const pendingGrades = submissions.filter(s => s.score === null).length;
  const gradedCount = submissions.filter(s => s.score !== null).length;

  // Submissions for selected assignment
  const assignmentSubmissions = selectedAssignment
    ? submissions.filter(s => s.assignment_id === selectedAssignment.id)
    : [];

  // Current chat messages
  const currentChatMessages = messages.filter(m =>
    (m.from_id === selectedChat && (m.to_id === user.id || m.to_email === user.email)) ||
    (m.from_id === user.id && m.to_id === selectedChat)
  ).sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f8fafc", color: "#111827" }}>
      {/* SIDEBAR */}
      <div style={{ width: 220, background: "linear-gradient(180deg,#8b5cf6 0%,#7c3aed 100%)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "22px 14px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0 }}>Багшийн самбар</p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, margin: 0 }}>Багш</p>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(item => {
            const active = activeNav === item.key;
            const badge = item.key === "chat" ? Object.keys(conversations).length : null;
            return (
              <button key={item.key} onClick={() => { setActiveNav(item.key); setSelectedAssignment(null); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textAlign: "left",
                background: active ? "white" : "transparent",
                color: active ? "#8b5cf6" : "rgba(255,255,255,0.9)",
              }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge != null && badge > 0 && (
                  <span style={{
                    background: active ? "#8b5cf6" : "rgba(255,255,255,0.25)",
                    color: "white", fontSize: 11, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 99,
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ margin: "0 10px 16px", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, margin: 0 }}>Багш</p>
          </div>
          <button onClick={logout} title="Гарах" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" /></svg>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "white", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>
              {activeNav === "dashboard" && `Сайн байна уу, ${displayName}!`}
              {activeNav === "assignments" && "Даалгаврууд"}
              {activeNav === "students" && "Сурагчид"}
              {activeNav === "chat" && "Мессежүүд"}
            </h1>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {/* DASHBOARD */}
          {activeNav === "dashboard" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Нийт даалгавар", value: assignments.length, bg: "#f3e8ff", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#8b5cf6"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" /></svg> },
                  { label: "Нийт сурагч", value: students.length, bg: "#e0f7fa", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#06b6d4"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3z" /></svg> },
                  { label: "Үнэлэх ажил", value: pendingGrades, bg: "#fff3e0", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /></svg> },
                  { label: "Үнэлсэн", value: gradedCount, bg: "#e8fdf5", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg> },
                ].map((s, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#111827" }}>{s.value}</p>
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                  </div>
                ))}
              </div>

              {/* Recent submissions */}
              <div style={{ background: "white", borderRadius: 16, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 15, color: "#111827" }}>Сүүлийн илгээлтүүд</p>
                {submissions.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>Илгээлт байхгүй</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {submissions.slice(0, 5).map(sub => {
                      const assignment = assignments.find(a => a.id === sub.assignment_id);
                      return (
                        <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                              {sub.student?.last_name} {sub.student?.first_name}
                            </p>
                            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>{assignment?.title}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {sub.score !== null ? (
                              <span style={{ fontSize: 16, fontWeight: 700, color: sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f97316" : "#ef4444" }}>{sub.score}%</span>
                            ) : (
                              <button onClick={() => { setGradeTarget(sub); setGradeInput(""); }}
                                style={{ background: "#8b5cf6", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>
                                Үнэлэх
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ASSIGNMENTS */}
          {activeNav === "assignments" && !selectedAssignment && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
                <button onClick={() => setShowCreate(true)}
                  style={{ background: "#8b5cf6", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 12 }}>
                  + Даалгавар нэмэх
                </button>
              </div>

              {assignments.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Даалгавар байхгүй</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {assignments.map(a => {
                    const subs = submissions.filter(s => s.assignment_id === a.id);
                    const graded = subs.filter(s => s.score !== null).length;
                    return (
                      <div key={a.id}
                        onClick={() => setSelectedAssignment(a)}
                        style={{ background: "white", borderRadius: 14, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>{a.title}</h3>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>{a.grade}-р анги | {fmtDate(a.deadline)}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{subs.length} илгээлт</p>
                            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>{graded} үнэлэгдсэн</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ASSIGNMENT DETAIL */}
          {activeNav === "assignments" && selectedAssignment && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <button onClick={() => setSelectedAssignment(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8b5cf6", fontWeight: 600, marginBottom: 16 }}>
                ← Буцах
              </button>

              <div style={{ background: "white", borderRadius: 14, padding: 20, marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>{selectedAssignment.title}</h2>
                {selectedAssignment.description && <p style={{ margin: "0 0 12px", color: "#6b7280" }}>{selectedAssignment.description}</p>}
                <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#9ca3af" }}>
                  <span>{selectedAssignment.grade}-р анги</span>
                  <span>{selectedAssignment.points} оноо</span>
                  <span>Хугацаа: {fmtDate(selectedAssignment.deadline)}</span>
                </div>
              </div>

              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Илгээлтүүд ({assignmentSubmissions.length})</h3>

              {assignmentSubmissions.length === 0 ? (
                <p style={{ color: "#9ca3af" }}>Илгээлт байхгүй</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {assignmentSubmissions.map(sub => (
                    <div key={sub.id} style={{ background: "white", borderRadius: 14, padding: 20 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>
                            {sub.student?.last_name} {sub.student?.first_name}
                          </p>
                          <p style={{ margin: "4px 0", fontSize: 12, color: "#9ca3af" }}>{relTime(sub.submitted_at)}</p>
                          {sub.text && <p style={{ margin: "8px 0 0", fontSize: 14, color: "#374151" }}>{sub.text}</p>}
                        </div>
                        <div>
                          {sub.score !== null ? (
                            <span style={{ fontSize: 20, fontWeight: 700, color: sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f97316" : "#ef4444" }}>{sub.score}%</span>
                          ) : (
                            <button onClick={() => { setGradeTarget(sub); setGradeInput(""); }}
                              style={{ background: "#8b5cf6", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 10 }}>
                              Үнэлэх
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STUDENTS */}
          {activeNav === "students" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              {students.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Сурагч байхгүй</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {students.map(s => {
                    const studentSubs = submissions.filter(sub => sub.student_id === s.id);
                    const avgScore = studentSubs.filter(sub => sub.score !== null).length > 0
                      ? Math.round(studentSubs.filter(sub => sub.score !== null).reduce((acc, sub) => acc + (sub.score || 0), 0) / studentSubs.filter(sub => sub.score !== null).length)
                      : null;
                    return (
                      <div key={s.id} style={{ background: "white", borderRadius: 14, padding: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f3e8ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6", fontWeight: 700, fontSize: 16 }}>
                            {s.first_name?.[0]?.toUpperCase() || s.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{s.last_name} {s.first_name}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>{s.grade}-р анги</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: "#9ca3af" }}>{studentSubs.length} илгээлт</span>
                          {avgScore !== null && <span style={{ fontWeight: 600, color: avgScore >= 80 ? "#10b981" : avgScore >= 50 ? "#f97316" : "#ef4444" }}>{avgScore}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CHAT */}
          {activeNav === "chat" && (
            <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
              {/* Conversations list */}
              <div style={{ width: 280, borderRight: "1px solid #e5e7eb", background: "white", overflowY: "auto" }}>
                <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Харилцагчид</p>
                </div>
                {Object.keys(conversations).length === 0 ? (
                  <p style={{ padding: 20, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>Мессеж байхгүй</p>
                ) : (
                  Object.entries(conversations).map(([senderId, conv]) => (
                    <button
                      key={senderId}
                      onClick={() => setSelectedChat(senderId)}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        border: "none",
                        borderBottom: "1px solid #f1f5f9",
                        background: selectedChat === senderId ? "#f3e8ff" : "white",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                        {conv.sender?.last_name} {conv.sender?.first_name}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>{conv.sender?.email}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>{relTime(conv.lastMessage)}</p>
                    </button>
                  ))
                )}
              </div>

              {/* Chat area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
                {!selectedChat ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ color: "#9ca3af" }}>Харилцагч сонгоно уу</p>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "16px 20px", background: "white", borderBottom: "1px solid #e5e7eb" }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {conversations[selectedChat]?.sender?.last_name} {conversations[selectedChat]?.sender?.first_name}
                      </p>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                      {currentChatMessages.length === 0 ? (
                        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Мессеж байхгүй</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {currentChatMessages.map(msg => {
                            const isMe = msg.from_id === user.id;
                            return (
                              <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                <div style={{
                                  maxWidth: "70%",
                                  padding: "12px 16px",
                                  borderRadius: 16,
                                  background: isMe ? "#8b5cf6" : "white",
                                  color: isMe ? "white" : "#111827",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                                }}>
                                  <p style={{ margin: 0, fontSize: 14 }}>{msg.text}</p>
                                  <p style={{ margin: "6px 0 0", fontSize: 10, opacity: 0.7 }}>{relTime(msg.sent_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef} />
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendChat} style={{ padding: 16, background: "white", borderTop: "1px solid #e5e7eb", display: "flex", gap: 12 }}>
                      <input
                        type="text"
                        placeholder="Мессеж бичих..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        style={{
                          padding: "12px 24px",
                          borderRadius: 12,
                          border: "none",
                          background: "#8b5cf6",
                          color: "white",
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: chatSending || !chatInput.trim() ? 0.6 : 1
                        }}
                      >
                        Илгээх
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: 480, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#111827" }}>Шинэ даалгавар</h3>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Гарчиг</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Тайлбар</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, resize: "none", height: 80 }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Анги</label>
                  <select
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
                    required
                  >
                    <option value="">Сонгох</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                      <option key={g} value={g}>{g}-р анги</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Оноо</label>
                  <input
                    type="number"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 100 })}
                    style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Эцсийн хугацаа</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14 }}
                />
              </div>

              {createError && (
                <p style={{ margin: "0 0 16px", color: "#ef4444", fontSize: 13 }}>{createError}</p>
              )}

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 600, cursor: "pointer", color: "#6b7280" }}
                >
                  Буцах
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#8b5cf6", color: "white", fontWeight: 700, cursor: "pointer", opacity: creating ? 0.6 : 1 }}
                >
                  {creating ? "Үүсгэж байна..." : "Үүсгэх"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {gradeTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 20, padding: 28, width: 400, maxWidth: "90%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>Үнэлгээ өгөх</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280" }}>
              {gradeTarget.student?.last_name} {gradeTarget.student?.first_name}
            </p>

            {gradeTarget.text && (
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>{gradeTarget.text}</p>
              </div>
            )}

            <form onSubmit={handleGrade}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>Оноо (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 16, fontWeight: 600 }}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setGradeTarget(null)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "1px solid #e5e7eb", background: "white", fontWeight: 600, cursor: "pointer", color: "#6b7280" }}
                >
                  Буцах
                </button>
                <button
                  type="submit"
                  disabled={grading}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#8b5cf6", color: "white", fontWeight: 700, cursor: "pointer", opacity: grading ? 0.6 : 1 }}
                >
                  {grading ? "Хадгалж байна..." : "Хадгалах"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
