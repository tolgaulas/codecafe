import React, { useState } from "react";
import ChatMessage from "./ChatMessage";
import { IoSend } from "react-icons/io5";

interface ChatPanelProps {
  userName: string;
  userColor: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ userName, userColor }) => {
  const [inputMessage, setInputMessage] = useState("");

  // Example mock messages for UI display only
  const mockMessages = [
    {
      id: "1",
      userName: "Example User",
      message: "Hello! This is an example message.",
      userColor: "#6366f1",
      timestamp: "12:03 PM",
    },
    {
      id: "2",
      userName: userName || "You",
      message: "Welcome to CodeCafe chat!",
      userColor: userColor,
      timestamp: "12:05 PM",
    },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would send the message
    setInputMessage("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pl-4 py-2 text-xs text-stone-400 sticky top-0 bg-stone-800 bg-opacity-60 z-10">
        CHAT
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto divide-stone-600">
        {mockMessages.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            userName={msg.userName}
            message={msg.message}
            userColor={msg.userColor}
            timestamp={msg.timestamp}
            isFirstMessage={index === 0}
          />
        ))}
      </div>

      {/* Message Input */}
      <div className="p-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="w-full bg-stone-800 border border-stone-600 text-stone-200 placeholder-stone-500 px-3 py-1.5 text-sm focus:outline-none focus:border-stone-500 transition-colors pr-10"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className={`absolute right-0 top-0 h-full px-3 flex items-center justify-center ${
              inputMessage.trim()
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
