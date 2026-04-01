"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPast, fmtDate, timeLeft, relTime } from "@/lib/formatters";

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const [assignments, setAssignments] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submitTarget, setSubmitTarget] = useState(null);
  const [submitText, setSubmitText] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef(null);

  // Multi-teacher chat state
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [allChatMessages, setAllChatMessages] = useState([]);
  const chatBottomRef = useRef(null);

  // Check auth and load profile
  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/");
        return;
      }
      setUser(authUser);

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profileData || profileData.role !== "student") {
        router.push("/");
        return;
      }
      setProfile(profileData);
      setLoading(false);
    }
    checkAuth();
  }, [router, supabase]);

  // Load all @olula.edu.mn teachers
  useEffect(() => {
    if (!profile) return;
    async function loadTeachers() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "teacher")
        .ilike("email", "%@olula.edu.mn");
      setTeachers(data || []);
    }
    loadTeachers();
  }, [profile, supabase]);

  // Load assignments for student's grade
  useEffect(() => {
    if (!profile) return;
    async function loadData() {
      // Load assignments for student's grade
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*, profiles!assignments_teacher_id_fkey(first_name, last_name, email)")
        .eq("grade", profile.grade);
      setAssignments(assignmentsData || []);

      // Load student's submissions
      const { data: subsData } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", profile.id);
      setMySubmissions(subsData || []);
    }
    loadData();
  }, [profile, supabase]);

  // Load all chat messages for sidebar
  useEffect(() => {
    if (!profile || activeTab !== "chat") return;
    async function loadAllChats() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
        .order("sent_at", { ascending: false });
      setAllChatMessages(data || []);
    }
    loadAllChats();
    const iv = setInterval(loadAllChats, 5000);
    return () => clearInterval(iv);
  }, [profile, activeTab, supabase]);

  // Load chat messages with selected teacher
  const loadChat = useCallback(async (teacherId) => {
    if (!profile || !teacherId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(from_user_id.eq.${profile.id},to_user_id.eq.${teacherId}),and(from_user_id.eq.${teacherId},to_user_id.eq.${profile.id})`)
      .order("sent_at", { ascending: true });
    setChatMessages(data || []);
  }, [profile, supabase]);

  useEffect(() => {
    if (!selectedTeacher) return;
    loadChat(selectedTeacher.id);
    const iv = setInterval(() => loadChat(selectedTeacher.id), 5000);
    return () => clearInterval(iv);
  }, [selectedTeacher, loadChat]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function getSubmission(aid) {
    return mySubmissions.find(s => s.assignment_id === aid) || null;
  }

  function isUrgent(deadline) {
    const d = new Date(deadline) - new Date();
    return d > 0 && d < 24 * 3600 * 1000;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!submitFile && !submitText.trim()) {
      setSubmitError("Зураг эсвэл тайлбар оруулна уу");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      let filePath = null;
      if (submitFile) {
        const fileExt = submitFile.name.split('.').pop();
        const fileName = `${profile.id}/${submitTarget.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("submissions")
          .upload(fileName, submitFile);
        if (uploadError) throw uploadError;
        filePath = fileName;
      }

      const { data, error } = await supabase
        .from("submissions")
        .upsert({
          assignment_id: submitTarget.id,
          student_id: profile.id,
          text: submitText,
          file_path: filePath,
          submitted_at: new Date().toISOString(),
        }, { onConflict: "assignment_id,student_id" })
        .select()
        .single();

      if (error) throw error;
      setMySubmissions(prev => [...prev.filter(s => s.assignment_id !== submitTarget.id), data]);
      setSubmitTarget(null);
      setSubmitText("");
      setSubmitFile(null);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTeacher) return;
    setChatSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          from_user_id: profile.id,
          to_user_id: selectedTeacher.id,
          text: chatInput,
        })
        .select()
        .single();
      if (error) throw error;
      setChatMessages(prev => [...prev, data]);
      setChatInput("");
    } finally {
      setChatSending(false);
    }
  }

  if (loading || !profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #06b6d4", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6b7280" }}>Ачаалж байна...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const displayName = profile.last_name && profile.first_name
    ? `${profile.last_name} ${profile.first_name}`
    : profile.email.split("@")[0];
  const initials = profile.last_name && profile.first_name
    ? (profile.last_name[0] + profile.first_name[0]).toUpperCase()
    : profile.email[0].toUpperCase();

  const activeAssignments = assignments.filter(a => !isPast(a.deadline));
  const pastAssignments = assignments.filter(a => isPast(a.deadline));
  const pendingCount = activeAssignments.filter(a => !getSubmission(a.id)).length;
  const gradedSubs = mySubmissions.filter(s => s.score !== null);
  const avgScore = gradedSubs.length
    ? Math.round(gradedSubs.reduce((s, sub) => s + sub.score, 0) / gradedSubs.length)
    : null;

  // Get teachers with conversations
  const teachersWithChats = teachers.filter(t => 
    allChatMessages.some(m => m.from_user_id === t.id || m.to_user_id === t.id)
  );

  // Count unread messages (last message from teacher)
  const getUnreadCount = (teacherId) => {
    const convo = allChatMessages
      .filter(m => m.from_user_id === teacherId || m.to_user_id === teacherId)
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
    return convo.length > 0 && convo[0].from_user_id === teacherId ? 1 : 0;
  };

  const totalUnread = teachers.reduce((sum, t) => sum + getUnreadCount(t.id), 0);

  const NAV = [
    { key: "dashboard", label: "Хяналтын самбар", badge: null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> },
    { key: "assignments", label: "Миний даалгавар", badge: pendingCount || null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg> },
    { key: "chat", label: "Багш нартай чат", badge: totalUnread || null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
  ];

  const S = {
    sidebar: { width: 220, background: "linear-gradient(180deg,#06b6d4 0%,#0891b2 100%)", display: "flex", flexDirection: "column", flexShrink: 0 },
    navBtn: (active) => ({
      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textAlign: "left",
      background: active ? "white" : "transparent",
      color: active ? "#06b6d4" : "rgba(255,255,255,0.9)",
    }),
    card: { background: "white", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f8fafc", color: "#111827" }}>

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={{ padding: "22px 14px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Сурагчийн самбар</p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, margin: 0 }}>{profile.grade}-р анги</p>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(item => {
            const active = activeTab === item.key;
            return (
              <button key={item.key} onClick={() => setActiveTab(item.key)} style={S.navBtn(active)}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && (
                  <span style={{
                    background: active ? "#06b6d4" : "rgba(255,255,255,0.25)",
                    color: "white", fontSize: 11, fontWeight: 700,
                    padding: "1px 7px", borderRadius: 99,
                  }}>{item.badge}</span>
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
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, margin: 0 }}>Сурагч</p>
          </div>
          <button onClick={logout} title="Гарах" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{ background: "white", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
          <div>
            {activeTab === "dashboard" && <>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Сайн байна уу, {displayName}!</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Өнөөдөр хичээлээ сайн явуулаарай</p>
            </>}
            {activeTab === "assignments" && <>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Миний даалгаврууд</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{assignments.length} даалгавар нийт</p>
            </>}
            {activeTab === "chat" && <>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" }}>Багш нартай чат</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>{teachers.length} багш @olula.edu.mn</p>
            </>}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>

          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Нийт даалгавар", value: assignments.length, bg: "#e0f7fa",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#06b6d4"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z"/></svg> },
                  { label: "Хүлээгдэж буй", value: pendingCount, bg: "#fff3e0",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg> },
                  { label: "Илгээсэн", value: mySubmissions.length, bg: "#e8fdf5",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> },
                  { label: "Дундаж үнэлгээ", value: avgScore !== null ? `${avgScore}%` : "—", bg: "#fff3e0",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg> },
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>Удахгүй болох даалгавар</p>
                      <button onClick={() => setActiveTab("assignments")}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#06b6d4", fontWeight: 600 }}>
                        Бүгдийг үзэх
                      </button>
                    </div>
                    {activeAssignments.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "20px 0", margin: 0 }}>Даалгавар байхгүй</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {activeAssignments.slice(0, 4).map(a => {
                          const sub = getSubmission(a.id);
                          const urgent = isUrgent(a.deadline);
                          const teacherName = a.profiles ? `${a.profiles.last_name || ""} ${a.profiles.first_name || ""}`.trim() || a.profiles.email : "Багш";
                          return (
                            <div key={a.id} style={{ borderLeft: "3px solid #06b6d4", paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, borderRadius: "0 10px 10px 0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</p>
                                  {urgent && !sub && <span style={{ background: "#f97316", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, flexShrink: 0 }}>Яаралтай</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#9ca3af", fontSize: 12 }}>
                                  <span>{teacherName}</span>
                                  <span>•</span>
                                  <span>{fmtDate(a.deadline)}</span>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>{a.points} оноо</span>
                                {sub ? (
                                  <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 99 }}>Илгээсэн</span>
                                ) : (
                                  <button onClick={() => { setSubmitTarget(a); setSubmitText(""); setSubmitFile(null); setSubmitError(""); }}
                                    style={{ background: "#06b6d4", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>
                                    Илгээх
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {gradedSubs.length > 0 && (
                    <div style={S.card}>
                      <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15, color: "#111827" }}>Сүүлийн үнэлгээ</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[...gradedSubs].sort((a, b) => new Date(b.graded_at) - new Date(a.graded_at)).slice(0, 3).map(sub => {
                          const asgn = assignments.find(a => a.id === sub.assignment_id);
                          const scoreColor = sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f97316" : "#ef4444";
                          return (
                            <div key={sub.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f8fafc", borderRadius: 10 }}>
                              <div>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#111827" }}>{asgn?.title || "Даалгавар"}</p>
                                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{relTime(sub.graded_at)}</p>
                              </div>
                              <span style={{ fontSize: 22, fontWeight: 900, color: scoreColor }}>{sub.score}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={S.card}>
                    <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 15, color: "#111827" }}>Багш нар</p>
                    {teachers.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "20px 0", margin: 0 }}>Багш олдсонгүй</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {teachers.slice(0, 5).map(t => {
                          const name = t.last_name && t.first_name ? `${t.last_name[0]}.${t.first_name}` : t.email.split("@")[0];
                          const init = t.last_name && t.first_name ? (t.last_name[0] + t.first_name[0]).toUpperCase() : t.email[0].toUpperCase();
                          return (
                            <div key={t.id} onClick={() => { setSelectedTeacher(t); setActiveTab("chat"); }}
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#f8fafc", cursor: "pointer" }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 11 }}>{init}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#111827" }}>{name}</p>
                                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{t.email}</p>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="#9ca3af"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                            </div>
                          );
                        })}
                        {teachers.length > 5 && (
                          <button onClick={() => setActiveTab("chat")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#06b6d4", fontWeight: 600, padding: "8px 0" }}>
                            +{teachers.length - 5} бусад багш
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ASSIGNMENTS */}
          {activeTab === "assignments" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "24px 28px" }}>
              <div style={S.card}>
                <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 15, color: "#111827" }}>Идэвхтэй даалгаврууд ({activeAssignments.length})</p>
                {activeAssignments.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "30px 0", margin: 0 }}>Идэвхтэй даалгавар байхгүй</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeAssignments.map(a => {
                      const sub = getSubmission(a.id);
                      const urgent = isUrgent(a.deadline);
                      const teacherName = a.profiles ? `${a.profiles.last_name || ""} ${a.profiles.first_name || ""}`.trim() || a.profiles.email : "Багш";
                      return (
                        <div key={a.id} style={{ borderLeft: "3px solid #06b6d4", paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderRadius: "0 10px 10px 0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111827" }}>{a.title}</p>
                              {urgent && !sub && <span style={{ background: "#f97316", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>Яаралтай</span>}
                            </div>
                            {a.description && <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6b7280" }}>{a.description}</p>}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#9ca3af", fontSize: 12 }}>
                              <span>{teacherName}</span>
                              <span>•</span>
                              <span>Хугацаа: {fmtDate(a.deadline)}</span>
                              <span>•</span>
                              <span>{a.points} оноо</span>
                            </div>
                          </div>
                          {sub ? (
                            <div style={{ textAlign: "right" }}>
                              <span style={{ background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 99 }}>Илгээсэн</span>
                              {sub.score !== null && <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 900, color: sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f97316" : "#ef4444" }}>{sub.score}%</p>}
                            </div>
                          ) : (
                            <button onClick={() => { setSubmitTarget(a); setSubmitText(""); setSubmitFile(null); setSubmitError(""); }}
                              style={{ background: "#06b6d4", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "10px 20px", borderRadius: 10 }}>
                              Илгээх
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {pastAssignments.length > 0 && (
                <div style={{ ...S.card, marginTop: 20 }}>
                  <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 15, color: "#111827" }}>Дууссан даалгаврууд ({pastAssignments.length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pastAssignments.map(a => {
                      const sub = getSubmission(a.id);
                      const teacherName = a.profiles ? `${a.profiles.last_name || ""} ${a.profiles.first_name || ""}`.trim() || a.profiles.email : "Багш";
                      return (
                        <div key={a.id} style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderRadius: 10, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: 0.7 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{a.title}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                              <span>{teacherName}</span>
                              <span>•</span>
                              <span>Дууссан: {fmtDate(a.deadline)}</span>
                            </div>
                          </div>
                          {sub ? (
                            <span style={{ fontSize: 18, fontWeight: 900, color: sub.score !== null ? (sub.score >= 80 ? "#10b981" : sub.score >= 50 ? "#f97316" : "#ef4444") : "#9ca3af" }}>
                              {sub.score !== null ? `${sub.score}%` : "Хүлээгдэж буй"}
                            </span>
                          ) : (
                            <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>Илгээгээгүй</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MULTI-TEACHER CHAT */}
          {activeTab === "chat" && (
            <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
              {/* Teacher list sidebar */}
              <div style={{ width: 280, borderRight: "1px solid #f1f5f9", display: "flex", flexDirection: "column", background: "white" }}>
                <div style={{ padding: "16px", borderBottom: "1px solid #f1f5f9" }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>Бүх @olula.edu.mn багш нар</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>{teachers.length} багш</p>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                  {teachers.map(t => {
                    const name = t.last_name && t.first_name ? `${t.last_name[0]}.${t.first_name}` : t.email.split("@")[0];
                    const init = t.last_name && t.first_name ? (t.last_name[0] + t.first_name[0]).toUpperCase() : t.email[0].toUpperCase();
                    const isSelected = selectedTeacher?.id === t.id;
                    const unread = getUnreadCount(t.id);
                    const lastMsg = allChatMessages
                      .filter(m => m.from_user_id === t.id || m.to_user_id === t.id)
                      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
                    return (
                      <div key={t.id} onClick={() => setSelectedTeacher(t)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 4,
                          background: isSelected ? "#e0f7fa" : "transparent",
                        }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{init}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#111827" }}>{name}</p>
                            {unread > 0 && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06b6d4" }} />}
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lastMsg ? lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? "..." : "") : t.email}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chat area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
                {!selectedTeacher ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ textAlign: "center", color: "#9ca3af" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ margin: "0 auto 12px", opacity: 0.5 }}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      <p style={{ margin: 0, fontSize: 14 }}>Багш сонгоод чат эхлүүлээрэй</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div style={{ padding: "14px 20px", background: "white", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#06b6d4", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>
                        {selectedTeacher.last_name && selectedTeacher.first_name
                          ? (selectedTeacher.last_name[0] + selectedTeacher.first_name[0]).toUpperCase()
                          : selectedTeacher.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>
                          {selectedTeacher.last_name && selectedTeacher.first_name
                            ? `${selectedTeacher.last_name} ${selectedTeacher.first_name}`
                            : selectedTeacher.email.split("@")[0]}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{selectedTeacher.email}</p>
                      </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                      {chatMessages.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>
                          <p style={{ margin: 0, fontSize: 13 }}>Одоохондоо мессеж байхгүй. Эхлээд бичээрэй!</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {chatMessages.map(m => {
                            const isMe = m.from_user_id === profile.id;
                            return (
                              <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                <div style={{
                                  maxWidth: "70%",
                                  padding: "10px 14px",
                                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                  background: isMe ? "#06b6d4" : "white",
                                  color: isMe ? "white" : "#111827",
                                  boxShadow: isMe ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                                }}>
                                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{m.text}</p>
                                  <p style={{ margin: "6px 0 0", fontSize: 10, opacity: 0.7, textAlign: "right" }}>
                                    {relTime(m.sent_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef} />
                        </div>
                      )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendChat} style={{ padding: "14px 20px", background: "white", borderTop: "1px solid #f1f5f9", display: "flex", gap: 12 }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Мессеж бичих..."
                        style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, outline: "none" }}
                      />
                      <button
                        type="submit"
                        disabled={chatSending || !chatInput.trim()}
                        style={{
                          padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
                          background: chatSending || !chatInput.trim() ? "#d1d5db" : "#06b6d4",
                          color: "white", fontWeight: 700, fontSize: 14,
                        }}>
                        {chatSending ? "..." : "Илгээх"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit modal */}
      {submitTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, width: 420, maxWidth: "90vw" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Даалгавар илгээх</h3>
              <button onClick={() => setSubmitTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9ca3af" }}>×</button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280" }}>{submitTarget.title}</p>
            <form onSubmit={handleSubmit}>
              <textarea
                value={submitText}
                onChange={e => setSubmitText(e.target.value)}
                placeholder="Тайлбар бичих..."
                rows={4}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, resize: "vertical", marginBottom: 12 }}
              />
              <div style={{ marginBottom: 16 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setSubmitFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: "10px 16px", borderRadius: 8, border: "1px dashed #d1d5db", background: "transparent", cursor: "pointer", fontSize: 13, color: "#6b7280", width: "100%" }}>
                  {submitFile ? submitFile.name : "Зураг хавсаргах (заавал биш)"}
                </button>
              </div>
              {submitError && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{submitError}</p>}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: submitting ? "#d1d5db" : "#06b6d4", color: "white", fontWeight: 700, fontSize: 14,
                }}>
                {submitting ? "Илгээж байна..." : "Илгээх"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
