import { useState, useEffect } from "react";
import { Card } from "@radix-ui/themes";
import { GoPersonAdd, GoLink, GoCheck } from "react-icons/go";
import { motion, AnimatePresence } from "framer-motion";
import { COLORS } from "../constants/colors";
import { ShareProfileProps } from "../types/props";

const ShareProfile = ({
  onNameChange,
  onColorChange,
  users,
  onStartSession,
  isSessionActive,
  sessionId,
  isJoiningSession,
  sessionCreatorName,
  onJoinSession,
  isSessionCreator = false,
  currentUserName, // Use this for the current user's name
  currentUserColor, // Use this for the current user's color
}: ShareProfileProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    currentUserColor || COLORS[0]
  );
  const [name, setName] = useState(currentUserName || "");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [availableColors, setAvailableColors] = useState<string[]>(COLORS);

  // Update internal state when props change
  useEffect(() => {
    setSelectedColor(currentUserColor || COLORS[0]);
  }, [currentUserColor]);

  useEffect(() => {
    setName(currentUserName || "");
  }, [currentUserName]);

  // Filter out colors that have already been picked by users
  useEffect(() => {
    const getAvailableColors = () => {
      if (!users || users.length === 0) return COLORS;

      const usedColors = users.map((user) => user.color);
      return COLORS.filter(
        (color) => !usedColors.includes(color) || color === currentUserColor
      );
    };

    setAvailableColors(getAvailableColors());
  }, [users, currentUserColor]);

  // Use the sessionId from props instead
  const shareableLink = sessionId
    ? `${window.location.origin}${window.location.pathname}?session=${sessionId}`
    : "";

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;

      // Add styles to prevent scrolling on the body
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      return () => {
        // Restore scrolling when component unmounts or modal closes
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";

        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const handleStartSession = () => {
    console.log("Starting session with:", {
      name,
      color: selectedColor,
    });
    setSessionStarted(true);
    onNameChange(name); // Update parent component with name
    onColorChange(selectedColor); // Update parent component with color
    onStartSession(); // Call parent's handler
  };

  const handleJoinSession = () => {
    console.log("Joining session with:", {
      name,
      color: selectedColor,
    });
    onNameChange(name); // Update parent component with name
    onColorChange(selectedColor); // Update parent component with color
    onJoinSession(); // Call parent's handler
    setSessionStarted(true);
    handleClose(); // Close the dialog after joining
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
    if (!sessionStarted && !isSessionActive) {
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

  // Function to copy session link to clipboard
  const copySessionLink = () => {
    if (!sessionId) return;

    const url = new URL(window.location.href);
    url.searchParams.set("session", sessionId);
    navigator.clipboard.writeText(url.toString());

    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Show join session dialog automatically if joining from a link
  useEffect(() => {
    if (isJoiningSession && !isSessionActive) {
      setIsOpen(true);
    }
  }, [isJoiningSession, isSessionActive]);

  // Update sessionStarted when isSessionActive changes
  useEffect(() => {
    if (isSessionActive) {
      setSessionStarted(true);
    }
  }, [isSessionActive]);

  // Get the display title based on the current state
  const getDialogTitle = () => {
    if (isJoiningSession && !isSessionActive) {
      return `Join ${sessionCreatorName || "Anonymous"}'s Session`;
    } else if (isSessionActive) {
      return "Share Session";
    } else {
      return "Create Session";
    }
  };

  // Get the subtitle based on the current state
  const getDialogSubtitle = () => {
    if (isJoiningSession && !isSessionActive) {
      return "Enter your name to join this collaborative session";
    } else if (isSessionActive) {
      return "Copy this link and send it to anyone you want to collaborate with";
    } else {
      return "Customize how others will see you during the collaboration session";
    }
  };

  // Determine which name and color to display in the avatar when in active session
  const getActiveSessionAvatarInfo = () => {
    if (isSessionCreator) {
      // If you're the creator, show your info
      return {
        name: name || currentUserName,
        color: selectedColor || currentUserColor,
      };
    } else {
      // If you're not the creator, find the creator in users or use session creator info
      const creator = users.find((user) => user.name === sessionCreatorName);
      if (creator) {
        return {
          name: creator.name,
          color: creator.color,
        };
      }
      // Fallback to session creator name and a default color
      return {
        name: sessionCreatorName,
        color: "#4ECDC4", // Default color for session creator if not found
      };
    }
  };

  const activeSessionAvatar = getActiveSessionAvatarInfo();

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
              className="w-full max-w-[32rem] mx-4 max-h-[90vh]"
            >
              <Card className="bg-neutral-900/80 backdrop-blur-lg border border-stone-800/50 shadow-2xl rounded-xl overflow-hidden">
                <div className="px-8 py-6 overflow-y-auto max-h-[80vh]">
                  {/* Title Section */}
                  <div className="mb-10">
                    <h2 className="text-2xl font-semibold text-stone-200">
                      {getDialogTitle()}
                    </h2>
                    <p className="text-stone-400 text-sm mt-1">
                      {getDialogSubtitle()}
                    </p>
                  </div>

                  {isSessionActive ? (
                    // Shareable Link UI (for anyone in a session)
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-6">
                        <div
                          className="w-24 h-24 rounded-full flex items-center justify-center text-[2.5rem] font-medium mx-auto mb-4"
                          style={{ backgroundColor: activeSessionAvatar.color }}
                        >
                          <span className="text-white/90">
                            {activeSessionAvatar.name
                              ? activeSessionAvatar.name[0].toUpperCase()
                              : ""}
                          </span>
                        </div>
                        <p className="text-center text-stone-300">
                          {isSessionCreator
                            ? `Session started as ${name || currentUserName}`
                            : `Session started by ${
                                sessionCreatorName || "Anonymous"
                              }`}
                        </p>
                      </div>

                      <div className="bg-stone-800/50 border border-stone-700/50 rounded-md p-1 mb-8">
                        <div className="flex items-center">
                          <div className="flex-1 truncate px-3 py-2 text-stone-300">
                            {shareableLink}
                          </div>
                          <button
                            className="flex items-center justify-center bg-stone-700/50 hover:bg-stone-600/50 text-stone-200 rounded px-3 py-2 transition-colors"
                            onClick={copySessionLink}
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
                  ) : (
                    // Setup Profile UI (for both creating and joining)
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="relative">
                        <div
                          className="w-[6.5rem] h-[6.5rem] rounded-full flex items-center justify-center text-5xl font-medium cursor-pointer shadow-lg relative overflow-hidden mx-auto md:mx-0"
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
                              className="absolute left-1/2 md:left-0 transform -translate-x-1/2 md:translate-x-0 top-[95px] bg-neutral-800/90 backdrop-blur-md p-2 rounded-xl border border-stone-700/50 shadow-xl z-50"
                            >
                              <div className="flex flex-wrap gap-1 w-24">
                                {/* Show available colors or fallback to all colors if none available */}
                                {(availableColors.length > 0
                                  ? availableColors
                                  : COLORS
                                ).map((color) => (
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
                                      onColorChange(color); // Sync with parent component immediately
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
                              onNameChange(e.target.value); // Sync with parent component immediately
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
                          <div className="flex gap-3 mt-4 md:mt-[54px]">
                            <button
                              className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-stone-700/50 text-stone-300 hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
                              onClick={handleClose}
                            >
                              Cancel
                            </button>
                            {isJoiningSession ? (
                              <button
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleJoinSession}
                                disabled={!name.trim()}
                              >
                                Join Session
                              </button>
                            ) : (
                              <button
                                className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleStartSession}
                                disabled={!name.trim()}
                              >
                                Start Session
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
