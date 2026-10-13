"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/auth-client";
import { Send, MessageCircle, Search, Stethoscope, User } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import toast from "react-hot-toast";

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchInbox() {
  const res = await fetch("/api/messages?inbox=true");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchConversation(withUserId: string) {
  const res = await fetch(`/api/messages?withUserId=${withUserId}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchDoctors() {
  const res = await fetch("/api/doctors?limit=50");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function sendMessage(data: { receiverId: string; content: string }) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to send");
  }
  return res.json();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, role, size = "md" }: { name: string; role: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const color = role === "DOCTOR" ? "bg-blue-500" : role === "ADMIN" ? "bg-red-500" : "bg-emerald-500";
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-bold flex-shrink-0", color, sz)}>
      {initials}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MessagesClient() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isPatient = session?.user?.role === "PATIENT";

  const { data: inboxData, isLoading: inboxLoading } = useQuery({
    queryKey: ["inbox"],
    queryFn: fetchInbox,
    refetchInterval: 5000, // poll every 5s
  });

  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["conversation", activeUserId],
    queryFn: () => fetchConversation(activeUserId!),
    enabled: !!activeUserId,
    refetchInterval: 3000,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: fetchDoctors,
    enabled: isPatient,
  });

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversation", activeUserId] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
      setInput("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send"),
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convData?.messages]);

  const handleSend = () => {
    if (!input.trim() || !activeUserId) return;
    sendMutation.mutate({ receiverId: activeUserId, content: input.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activePartner = inboxData?.conversations?.find(
    (c: any) => c.partner.id === activeUserId
  )?.partner;

  // For patients starting a new chat with a doctor
  const filteredDoctors = doctorsData?.doctors?.filter((d: any) =>
    d.user.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="flex h-full bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">

      {/* ── Sidebar: conversations ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-3">Messages</h2>
          {isPatient && (
            <button
              onClick={() => setNewChatOpen(!newChatOpen)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-xl transition-colors"
            >
              <Stethoscope className="w-4 h-4" />
              Message a Doctor
            </button>
          )}
        </div>

        {/* New chat: doctor picker (patients only) */}
        <AnimatePresence>
          {newChatOpen && isPatient && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-gray-100"
            >
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search doctors..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredDoctors.map((d: any) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setActiveUserId(d.user.id);
                        setNewChatOpen(false);
                        setSearch("");
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-left transition-colors"
                    >
                      <Avatar name={d.user.name} role="DOCTOR" size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">Dr. {d.user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{d.specialization}</p>
                      </div>
                    </button>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No doctors found</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {inboxLoading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!inboxLoading && inboxData?.conversations?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageCircle className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              {isPatient && (
                <p className="text-xs text-gray-400 mt-1">Click "Message a Doctor" to start</p>
              )}
            </div>
          )}

          {inboxData?.conversations?.map((conv: any) => (
            <button
              key={conv.partner.id}
              onClick={() => setActiveUserId(conv.partner.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50",
                activeUserId === conv.partner.id && "bg-blue-50 border-l-2 border-l-blue-600"
              )}
            >
              <div className="relative">
                <Avatar name={conv.partner.name} role={conv.partner.role} size="md" />
                {conv.unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {conv.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {conv.partner.role === "DOCTOR" ? "Dr. " : ""}{conv.partner.name}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                    {formatTime(conv.lastMessage.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage.content}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col">
        {!activeUserId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4"
            >
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </motion.div>
            <h3 className="font-semibold text-gray-700 mb-1">Select a conversation</h3>
            <p className="text-sm text-gray-400">
              {isPatient ? "Choose a doctor to start chatting" : "Select a conversation from the left"}
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
              {activePartner ? (
                <>
                  <Avatar name={activePartner.name} role={activePartner.role} />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {activePartner.role === "DOCTOR" ? "Dr. " : ""}{activePartner.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{activePartner.role.toLowerCase()}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {convLoading && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!convLoading && convData?.messages?.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-sm text-gray-400">No messages yet. Say hello! 👋</p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {convData?.messages?.map((msg: any) => {
                  const isMe = msg.senderId === session?.user?.id;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}
                    >
                      {!isMe && <Avatar name={msg.sender.name} role={msg.sender.role} size="sm" />}
                      <div className={cn("max-w-xs lg:max-w-md", isMe ? "items-end" : "items-start", "flex flex-col gap-1")}>
                        <div
                          className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                            isMe
                              ? "bg-blue-600 text-white rounded-tr-sm"
                              : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm"
                          )}
                        >
                          {msg.content}
                        </div>
                        <span className="text-xs text-gray-400 px-1">{formatTime(msg.createdAt)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-4 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 max-h-32"
                  style={{ minHeight: "44px" }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  {sendMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
