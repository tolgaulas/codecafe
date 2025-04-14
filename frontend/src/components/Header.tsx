import React, { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiCopy } from "react-icons/fi";
import { RemoteUser } from "../types/props"; // Adjust path if needed
import { COLORS } from "../constants/colors"; // Adjust path if needed

// Define props based on what the header section uses from App.tsx
interface HeaderProps {
  isViewMenuOpen: boolean;
  setIsViewMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleWebView: () => void;
  toggleTerminalVisibility: () => void;
  isWebViewVisible: boolean;
  isTerminalCollapsed: boolean;
  handleRunCode: () => void;
  isShareMenuOpen: boolean;
  toggleShareMenu: () => void;
  shareMenuView: "initial" | "link";
  userName: string;
  userColor: string;
  handleNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleColorSelect: (color: string) => void;
  isColorPickerOpen: boolean;
  handleToggleColorPicker: () => void;
  handleStartSession: () => Promise<void>;
  generatedShareLink: string | null;
  handleCopyShareLink: () => void;
  isSessionActive: boolean;
  uniqueRemoteParticipants: RemoteUser[];
  // Need a way to close color picker from outside click effect in header
  setIsColorPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header: React.FC<HeaderProps> = ({
  isViewMenuOpen,
  setIsViewMenuOpen,
  toggleWebView,
  toggleTerminalVisibility,
  isWebViewVisible,
  isTerminalCollapsed,
  handleRunCode,
  isShareMenuOpen,
  toggleShareMenu,
  shareMenuView,
  userName,
  userColor,
  handleNameChange,
  handleColorSelect,
  isColorPickerOpen,
  handleToggleColorPicker,
  handleStartSession,
  generatedShareLink,
  handleCopyShareLink,
  isSessionActive,
  uniqueRemoteParticipants,
  setIsColorPickerOpen, // Added prop
}) => {
  // Refs previously in App.tsx, now belong here
  const headerRef = useRef<HTMLDivElement>(null);
  const viewMenuButtonRef = useRef<HTMLButtonElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // --- Effect to handle closing View menu on outside click ---
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isViewMenuOpen &&
        viewMenuRef.current &&
        !viewMenuRef.current.contains(event.target as Node) &&
        viewMenuButtonRef.current &&
        !viewMenuButtonRef.current.contains(event.target as Node)
      ) {
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewMenuOpen, setIsViewMenuOpen]);

  // --- Effect to handle closing Share menu & Color Picker on outside click ---
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isShareMenuOpen && // Only act if the main share menu is open
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node) &&
        shareButtonRef.current &&
        !shareButtonRef.current.contains(event.target as Node)
      ) {
        // Check if the click was outside the Share menu AND the Share button
        toggleShareMenu(); // Close the main share menu
        // We also need to ensure the color picker closes if it was open
        // The simplest way is to unconditionally set it to false here.
        setIsColorPickerOpen(false);
      } else if (
        isColorPickerOpen && // Separately handle clicks outside the color picker itself when it's open
        shareMenuRef.current && // Assumes color picker is inside shareMenuRef
        !shareMenuRef.current.contains(event.target as Node)
        // We don't need to check shareButtonRef here, clicking the button should toggle the menu anyway
      ) {
        // This case might be redundant if the first block handles it,
        // but let's keep it explicit for clicks outside the menu while picker is open.
        // Check if click is outside the avatar/color picker area perhaps?
        // For simplicity, let's rely on the first block and clicking the avatar to toggle the picker.
        // The main menu closing logic should handle the picker too.
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // Depend on the states and setters/toggles involved
  }, [
    isShareMenuOpen,
    isColorPickerOpen,
    toggleShareMenu,
    setIsColorPickerOpen,
  ]);

  return (
    <div
      ref={headerRef}
      className="flex items-stretch justify-between bg-stone-800 bg-opacity-80 border-b border-stone-600 flex-shrink-0 relative h-11"
    >
      {/* Left Buttons Container */}
      <div className="flex items-stretch">
        <div className="flex h-full">
          <button className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600">
            File
          </button>
          <button className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600">
            Edit
          </button>
          <button
            className={`h-full flex items-center px-3 text-sm ${
              isViewMenuOpen
                ? "bg-stone-600 text-stone-200"
                : "text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
            } relative`}
            onClick={() => setIsViewMenuOpen((prev) => !prev)}
            ref={viewMenuButtonRef}
          >
            View
          </button>
          <button
            className="h-full flex items-center px-3 text-sm text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
            onClick={handleRunCode} // Use prop
          >
            Run
          </button>
        </div>
        {/* View Dropdown Menu */}
        {isViewMenuOpen && (
          <div
            ref={viewMenuRef}
            className="absolute bg-stone-700 border border-stone-600 shadow-lg z-50 whitespace-nowrap"
            style={{
              left: `${viewMenuButtonRef.current?.offsetLeft ?? 0}px`,
              top: `${headerRef.current?.offsetHeight ?? 0}px`,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleWebView(); // Use prop
              }}
              className="block w-full text-left px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-600"
            >
              {isWebViewVisible ? "Close Web View" : "Open Web View"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleTerminalVisibility(); // Use prop
              }}
              className="block w-full text-left px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-600"
            >
              {!isTerminalCollapsed ? "Close Terminal" : "Open Terminal"}
            </button>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-stretch mr-2">
        {/* Participant Circles */}
        {isSessionActive && uniqueRemoteParticipants.length > 0 && (
          <div className="flex items-center px-2 -space-x-2">
            {uniqueRemoteParticipants.map((user) => (
              <div
                key={user.id}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ring-1 ring-stone-900/50 cursor-default shadow-sm"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                <span className="text-white/90 select-none">
                  {user.name ? user.name[0].toUpperCase() : "?"}
                </span>
              </div>
            ))}
          </div>
        )}
        {/* Share Button & Dropdown */}
        <div className="relative flex h-full">
          <button
            ref={shareButtonRef}
            onClick={toggleShareMenu} // Use prop
            className={`h-full flex items-center px-4 text-sm ${
              isShareMenuOpen
                ? "bg-stone-600 text-stone-200"
                : "text-stone-500 hover:bg-stone-700 hover:text-stone-200 active:bg-stone-600"
            }`}
          >
            Share
          </button>
          <AnimatePresence>
            {isShareMenuOpen && (
              <motion.div
                ref={shareMenuRef}
                className="absolute right-0 w-64 bg-stone-800 border border-stone-700 shadow-xl z-50 p-4"
                style={{
                  top: `${headerRef.current?.offsetHeight ?? 0}px`,
                }}
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.1 }}
              >
                {shareMenuView === "initial" && (
                  <>
                    {/* Avatar/Name Row */}
                    <div className="flex items-end gap-3 mb-4">
                      {/* Avatar and Color Picker Container */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium cursor-pointer shadow-md ring-1 ring-stone-500/50"
                          style={{ backgroundColor: userColor }}
                          onClick={handleToggleColorPicker} // Use prop
                        >
                          <span className="text-white/90">
                            {userName ? userName[0].toUpperCase() : ""}
                          </span>
                        </div>

                        {/* Color Picker Popover */}
                        <AnimatePresence>
                          {isColorPickerOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -5 }}
                              transition={{ duration: 0.1 }}
                              className="absolute left-0 top-full mt-2 bg-neutral-900/90 backdrop-blur-sm p-2.5 border border-stone-700 shadow-lg z-10 w-[120px]"
                              onClick={(e) => e.stopPropagation()} // Prevent closing menu when clicking picker
                            >
                              <div className="flex flex-wrap gap-1.5">
                                {COLORS.map((color) => (
                                  <div
                                    key={color}
                                    className={`w-5 h-5 rounded-full cursor-pointer ${
                                      userColor === color
                                        ? "ring-2 ring-white/60"
                                        : ""
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleColorSelect(color)} // Use prop
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Name Input Container */}
                      <div className="flex-1">
                        <label className="block text-xs text-stone-400 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={userName}
                          onChange={handleNameChange} // Use prop
                          placeholder="Enter your name"
                          className="w-full bg-neutral-800 border border-stone-600 text-stone-200 placeholder-stone-500 px-2 py-1 text-sm focus:outline-none focus:border-stone-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Start Session Button */}
                    <button
                      onClick={handleStartSession} // Use prop
                      disabled={!userName.trim()}
                      className="w-full px-3 py-1.5 text-sm font-medium bg-stone-600 hover:bg-stone-500 text-stone-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start Session
                    </button>
                  </>
                )}

                {shareMenuView === "link" && generatedShareLink && (
                  <div className="flex flex-col">
                    <p className="text-sm text-stone-400 text-left mb-1">
                      Share this link:
                    </p>
                    <div className="flex items-stretch gap-2 bg-neutral-900 border border-stone-700">
                      <input
                        type="text"
                        readOnly
                        value={generatedShareLink}
                        className="flex-1 bg-transparent text-stone-300 text-sm outline-none select-all px-2 py-1.5"
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        onClick={handleCopyShareLink} // Use prop
                        className="px-2 flex items-center justify-center text-stone-400 hover:text-stone-100 bg-stone-700 hover:bg-stone-600 transition-colors flex-shrink-0"
                        aria-label="Copy link"
                      >
                        <FiCopy size={16} />
                      </button>
                    </div>
                    <button
                      onClick={toggleShareMenu} // Use prop to close
                      className="mt-4 w-full px-3 py-1.5 text-sm font-medium bg-stone-600 hover:bg-stone-500 text-stone-100 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Help Button */}
        <button className="h-full flex items-center justify-center w-10 rounded-none hover:bg-neutral-900 active:bg-stone-950 text-stone-500 hover:text-stone-400">
          <span className="text-sm">?</span>
        </button>
      </div>
    </div>
  );
};

export default Header;
