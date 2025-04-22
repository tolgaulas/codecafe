import React from "react";

interface ChatMessageProps {
  userName: string;
  message: string;
  userColor: string;
  timestamp?: string;
  isFirstMessage?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  userName,
  message,
  userColor,
  timestamp,
  isFirstMessage = false,
}) => {
  // Get the first letter of the username (or '?' if empty)
  const firstLetter = userName ? userName[0].toUpperCase() : "?";

  return (
    <div className="py-3 border-b border-stone-600 hover:bg-stone-800/40">
      <div className="flex items-start px-2">
        {/* User Avatar/Icon */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full mr-2 flex items-center justify-center text-xs font-medium shadow-sm"
          style={{ backgroundColor: userColor }}
        >
          <span className="text-white/90 select-none">{firstLetter}</span>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-medium text-xs text-stone-300">
              {userName}
            </span>
            {timestamp && (
              <span className="text-xs text-stone-500 ml-2">{timestamp}</span>
            )}
          </div>
          <p className="text-sm text-stone-400 break-words">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
