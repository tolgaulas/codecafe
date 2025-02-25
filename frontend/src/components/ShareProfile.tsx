import React, { useState } from "react";
import { Card } from "@radix-ui/themes";
import { GoPersonAdd } from "react-icons/go";
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

interface ShareProfileProps {
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  //   initialColor: string;
  //   initialName: string;
}

const ShareProfile: React.FC<ShareProfileProps> = ({
  onNameChange,
  onColorChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [name, setName] = useState("");
  // className="flex items-center justify-center p-2 rounded-md transition-all duration-200 bg-transparent hover:bg-neutral-900 active:bg-stone-950 active:scale-95 text-stone-500 hover:text-stone-400 ml-1 -mr-2">
  return (
    <>
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-500 hover:bg-neutral-900 bg-transparen active:scale-95 active:bg-stone-950 hover:text-stone-30 rounded-md transition-all duration-200 ml-auto"
        onClick={() => setIsOpen(true)}
      >
        <GoPersonAdd className="text-lg" />
        <span>Share</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[5px] flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsOpen(false);
                setIsColorPickerOpen(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[34rem] mx-4"
            >
              <Card className="bg-neutral-900/80 backdrop-blur-lg border border-stone-800/50 shadow-2xl rounded-xl overflow-visible">
                <div className="px-8 py-6">
                  {/* Added Title Section */}
                  <div className="mb-10">
                    <h2 className="text-2xl font-semibold text-stone-200">
                      Start Sharing
                    </h2>
                    <p className="text-stone-400 text-sm mt-1">
                      Customize how others will see you during the collaboration
                      session
                    </p>
                  </div>

                  <div className="flex gap-6">
                    <div className="relative">
                      <div
                        className="w-[6.5rem] h-[6.5rem] rounded-full flex items-center justify-center text-5xl font-medium cursor-pointer shadow-lg relative overflow-hidden"
                        style={{ backgroundColor: selectedColor }}
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                      >
                        <span className="text-white/90">
                          {name ? name[0].toUpperCase() : ""}
                        </span>
                      </div>

                      <AnimatePresence>
                        {isColorPickerOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }} // Changed from y: 10
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }} // Changed from y: 10
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 top-[118px] bg-neutral-800/90 backdrop-blur-md p-2 rounded-xl border border-stone-700/50 shadow-xl z-50" // Changed top to bottom
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
                                    onColorChange(color); // Add this line
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
                            onNameChange(e.target.value); // Add this line
                          }}
                          placeholder="Enter your name"
                          className="w-full bg-stone-800/50 border border-stone-700/50 text-stone-200 placeholder-stone-500 rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 transition-colors"
                        />
                        <p className="text-stone-500 text-[12px] mt-1.5">
                          This name will be visible to other participants in the
                          session
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex gap-3 mt-[54px]">
                          <button
                            className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-stone-700/50 text-stone-300 hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
                            onClick={() => setIsOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              console.log("Starting session with:", {
                                name,
                                color: selectedColor,
                              });
                              setIsOpen(false);
                            }}
                            disabled={!name.trim()}
                          >
                            Start Session
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
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
