import React, { useState, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import { IoSend } from "react-icons/io5";

interface ChatMessage {
  userId: string;
  userName: string;
  userColor: string;
  message: string;
  timestamp: string;
  formattedTimestamp?: string;
}

interface ChatPanelProps {
  userName: string;
  userColor: string;
  sessionId: string | null;
  isSessionActive: boolean;
  userId: string;
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  userName,
  userColor,
  sessionId,
  isSessionActive,
  userId,
  onSendMessage,
  messages,
}) => {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    // Auto-adjust height
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !isSessionActive) return;

    // Send the message
    onSendMessage(inputMessage.trim());

    // Clear input
    setInputMessage("");

    // Reset textarea height
    const textarea = document.querySelector("textarea");
    if (textarea) {
      textarea.style.height = "auto";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
        CHAT {!isSessionActive && "(Join a session to chat)"}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto divide-stone-600">
        {messages.length > 0 ? (
          <>
            {messages.map((msg, index) => (
              <ChatMessage
                key={`${msg.userId}-${index}`}
                userName={msg.userName}
                message={msg.message}
                userColor={msg.userColor}
                timestamp={msg.formattedTimestamp || msg.timestamp}
                isFirstMessage={index === 0}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-10 text-stone-500 text-sm">
            {isSessionActive
              ? "No messages yet. Start the conversation!"
              : "Join a session to start chatting."}
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <textarea
            value={inputMessage}
            onChange={handleInputChange}
            placeholder={
              isSessionActive ? "Type a message..." : "Join a session to chat"
            }
            disabled={!isSessionActive}
            className={`w-full bg-stone-800 border border-stone-600 text-stone-200 placeholder-stone-500 px-3 py-2 text-sm focus:outline-none focus:border-stone-500 transition-colors pr-10 resize-none min-h-[36px] max-h-[150px] overflow-y-auto ${
              !isSessionActive ? "opacity-50 cursor-not-allowed" : ""
            }`}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || !isSessionActive}
            className={`absolute right-0 h-8 flex items-center justify-center px-3 ${
              inputMessage.trim() && isSessionActive
                ? "text-stone-300 hover:text-stone-100"
                : "text-stone-600 cursor-not-allowed"
            }`}
          >
            <IoSend />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
