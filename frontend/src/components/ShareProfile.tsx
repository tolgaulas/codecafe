import React, { useState } from "react";
import { Card } from "@radix-ui/themes";
import { GoPersonAdd, GoLink, GoCheck } from "react-icons/go";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEEAD",
  "#D4A5A5",
  "#9B59B6",
  "#3498DB",
  "#E74C3C",
  "#2ECC71",
];

interface User {
  id: string;
  name: string;
  color: string;
  cursorPosition: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

// Add isSessionActive to the props interface
interface ShareProfileProps {
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  users: User[];
  onStartSession: () => void;
  sessionLink?: string;
  isSessionActive?: boolean; // Add this prop
}

// Add isSessionActive to destructured props
const ShareProfile: React.FC<ShareProfileProps> = ({
  onNameChange,
  onColorChange,
  users,
  onStartSession,
  sessionLink,
  isSessionActive = false // Default to false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [name, setName] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Generate a unique session ID (in a real app, this would come from your backend)
  const sessionId = Math.random().toString(36).substring(2, 15);
  const shareableLink = `https://yourdomain.com/session/${sessionId}`;

  const handleStartSession = () => {
    console.log("Starting session with:", {
      name,
      color: selectedColor,
    });
    setSessionStarted(true);
    onStartSession(); // Call parent's handler
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    // setSessionStarted(false);
    setIsColorPickerOpen(false);
  };

  const renderShareButtonOrUserAvatars = () => {
    if (!sessionStarted) {
      return (
        <button
          className="flex items-center gap-1.5 px-2 text-sm  text-stone-500 hover:bg-neutral-900 bg-transparent active:scale-95 active:bg-stone-950 hover:text-stone-400 rounded-md transition-all duration-200 ml-auto"
          onClick={() => setIsOpen(true)}
        >
          <GoPersonAdd className="text-lg" />
          <span>Share</span>
        </button>
      );
    }

    return (
      <div className="flex items-center gap-1 ml-auto">
        {/* Display user avatars */}
        {users.slice(0, 3).map((user) => (
          <div
            key={user.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shadow-md`}
            style={{
              backgroundColor: user.color,
            }}
          >
            <span className="text-white/90">
              {user.name ? user.name[0].toUpperCase() : ""}
            </span>
          </div>
        ))}

        {/* Additional users count */}
        {users.length > 3 && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-stone-700 text-stone-300 shadow-md">
            +{users.length - 3}
          </div>
        )}

        {/* Button to reopen share dialog */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-900 hover:bg-stone-700 cursor-pointer transition-colors shadow-md"
          onClick={() => setIsOpen(true)}
        >
          <div className="flex items-center justify-center gap-[3px]">
            <div className="w-1 h-1 rounded-full bg-stone-400"></div>
            <div className="w-1 h-1 rounded-full bg-stone-400"></div>
            <div className="w-1 h-1 rounded-full bg-stone-400"></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderShareButtonOrUserAvatars()}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[5px] flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClose();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[32rem] mx-4"
            >
              <Card className="bg-neutral-900/80 backdrop-blur-lg border border-stone-800/50 shadow-2xl rounded-xl overflow-visible">
                <div className="px-8 py-6">
                  {/* Title Section */}
                  <div className="mb-10">
                    <h2 className="text-2xl font-semibold text-stone-200">
                      {sessionStarted ? "Share Your Session" : "Start Sharing"}
                    </h2>
                    <p className="text-stone-400 text-sm mt-1">
                      {sessionStarted
                        ? "Copy this link and send it to anyone you want to collaborate with"
                        : "Customize how others will see you during the collaboration session"}
                    </p>
                  </div>

                  {!sessionStarted ? (
                    // Setup Profile UI
                    <div className="flex gap-6">
                      <div className="relative">
                        <div
                          className="w-[6.5rem] h-[6.5rem] rounded-full flex items-center justify-center text-5xl font-medium cursor-pointer shadow-lg relative overflow-hidden"
                          style={{ backgroundColor: selectedColor }}
                          onClick={() =>
                            setIsColorPickerOpen(!isColorPickerOpen)
                          }
                        >
                          <span className="text-white/90">
                            {name ? name[0].toUpperCase() : ""}
                          </span>
                        </div>
                        <AnimatePresence>
                          {isColorPickerOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              transition={{ duration: 0.2 }}
                              className="absolute -left-1 top-[95px] bg-neutral-800/90 backdrop-blur-md p-2 rounded-xl border border-stone-700/50 shadow-xl z-50"
                            >
                              <div className="flex flex-wrap gap-1 w-24">
                                {COLORS.map((color) => (
                                  <div
                                    key={color}
                                    className={`w-5 h-5 rounded-full cursor-pointer ${
                                      selectedColor === color
                                        ? "ring-2 ring-white/40"
                                        : ""
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => {
                                      setSelectedColor(color);
                                      onColorChange(color);
                                      setIsColorPickerOpen(false);
                                    }}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-300 mb-1.5">
                            Display Name
                          </label>
                          <input
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              onNameChange(e.target.value);
                            }}
                            placeholder="Enter your name"
                            className="w-full bg-stone-800/50 border border-stone-700/50 text-stone-200 placeholder-stone-500 rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 transition-colors"
                          />
                          <p className="text-stone-500 text-[12px] mt-1.5">
                            This name will be visible to other participants in
                            the session
                          </p>
                        </div>
                        <div className="pt-2">
                          <div className="flex gap-3 mt-[54px]">
                            <button
                              className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-stone-700/50 text-stone-300 hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
                              onClick={handleClose}
                            >
                              Cancel
                            </button>
                            <button
                              className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={handleStartSession}
                              disabled={!name.trim()}
                            >
                              Start Session
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Shareable Link UI
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-6">
                        <div
                          className="w-24 h-24 rounded-full flex items-center justify-center text-[2.5rem] font-medium mx-auto mb-4"
                          style={{ backgroundColor: selectedColor }}
                        >
                          <span className="text-white/90">
                            {name ? name[0].toUpperCase() : ""}
                          </span>
                        </div>
                        <p className="text-center text-stone-300">
                          Session started as{" "}
                          <span className="font-medium text-stone-200">
                            {name}
                          </span>
                        </p>
                      </div>

                      <div className="bg-stone-800/50 border border-stone-700/50 rounded-md p-1 mb-8">
                        <div className="flex items-center">
                          <div className="flex-1 truncate px-3 py-2 text-stone-300">
                            {shareableLink}
                          </div>
                          <button
                            className="flex items-center justify-center bg-stone-700/50 hover:bg-stone-600/50 text-stone-200 rounded px-3 py-2 transition-colors"
                            onClick={handleCopyLink}
                          >
                            {linkCopied ? (
                              <>
                                <GoCheck className="mr-1" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <GoLink className="mr-1" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-stone-700/50 text-stone-300 hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
                          onClick={handleClose}
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ShareProfile;
