"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { relTime } from "@/lib/formatters";

const AVATAR_COLORS = ["#f97316","#06b6d4","#8b5cf6","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899"];
function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let n = 0; for (let i = 0; i < str.length; i++) n += str.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function ParentDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const router = useRouter();
  const supabase = createClient();

  // Teachers list
  const [teachers, setTeachers] = useState([]);
  
  // Chat state
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [allChatMessages, setAllChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef(null);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/");
        return;
      }
      setUser(authUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (!profileData || profileData.role !== "parent") {
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

  // Load all chat messages
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

  // Load chat with selected teacher
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

  // Get unread count
  const getUnreadCount = (teacherId) => {
    const convo = allChatMessages
      .filter(m => m.from_user_id === teacherId || m.to_user_id === teacherId)
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
    return convo.length > 0 && convo[0].from_user_id === teacherId ? 1 : 0;
  };

  const totalUnread = teachers.reduce((sum, t) => sum + getUnreadCount(t.id), 0);

  if (loading || !profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f0fdfd" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #f97316", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
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

  const NAV = [
    { key: "dashboard", label: "Хяналтын самбар", badge: null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> },
    { key: "chat", label: "Багш нартай чат", badge: totalUnread || null,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
  ];

  const S = {
    sidebar: { width: 220, background: "linear-gradient(180deg,#f97316 0%,#ea580c 100%)", display: "flex", flexDirection: "column", flexShrink: 0 },
    navBtn: (active) => ({
      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textAlign: "left",
      background: active ? "white" : "transparent",
      color: active ? "#f97316" : "rgba(255,255,255,0.9)",
    }),
    card: { background: "white", borderRadius: 16, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f0fdfd", color: "#111827" }}>

      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={{ padding: "22px 14px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Эцэг эхийн самбар</p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, margin: 0 }}>Хяналт</p>
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
                    background: active ? "#f97316" : "rgba(255,255,255,0.25)",
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
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, margin: 0 }}>Эцэг эх</p>
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
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Эцэг эхийн хяналтын самбар</p>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Багш нар", value: teachers.length, bg: "#e0f7fa",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#06b6d4"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> },
                  { label: "Шинэ мессеж", value: totalUnread, bg: "#fff7ed",
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#f97316"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> },
                ].map((s, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{s.label}</p>
                      <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#111827" }}>{s.value}</p>
                    </div>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <p style={{ margin: "0 0 16px", fontWeight: 700, fontSize: 15, color: "#111827" }}>@olula.edu.mn Багш нар</p>
                {teachers.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#d1d5db", fontSize: 13, padding: "30px 0", margin: 0 }}>Багш олдсонгүй</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                    {teachers.map(t => {
                      const name = t.last_name && t.first_name ? `${t.last_name} ${t.first_name}` : t.email.split("@")[0];
                      const init = t.last_name && t.first_name ? (t.last_name[0] + t.first_name[0]).toUpperCase() : t.email[0].toUpperCase();
                      const unread = getUnreadCount(t.id);
                      return (
                        <div key={t.id} onClick={() => { setSelectedTeacher(t); setActiveTab("chat"); }}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "#f8fafc", cursor: "pointer" }}>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: avatarColor(t.email), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>{init}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#111827" }}>{name}</p>
                            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{t.email}</p>
                          </div>
                          {unread > 0 && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316" }} />}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#9ca3af"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CHAT */}
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
                          background: isSelected ? "#fff7ed" : "transparent",
                        }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: avatarColor(t.email), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{init}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#111827" }}>{name}</p>
                            {unread > 0 && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316" }} />}
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
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: avatarColor(selectedTeacher.email), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14 }}>
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
                                  background: isMe ? "#f97316" : "white",
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
                          background: chatSending || !chatInput.trim() ? "#d1d5db" : "#f97316",
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
    </div>
  );
}
