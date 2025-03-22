import React, { useState, useEffect } from "react";
import { Card } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";
import { VscCheck } from "react-icons/vsc";

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  // New props for language handling
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  availableLanguages: Array<{ value: string; label: string }>;
  currentTheme: "codeCafeTheme" | "transparentTheme"; // Add this
  onThemeChange: (theme: "codeCafeTheme" | "transparentTheme") => void; // Add this
  currentFontSize: string;
  onFontSizeChange: (fontSize: string) => void;
  currentWordWrap: boolean;
  onWordWrapChange: (wordWrap: boolean) => void;
  currentShowLineNumbers: boolean;
  onShowLineNumbersChange: (showLineNumbers: boolean) => void;
}

const THEMES = [
  { value: "codeCafeTheme", label: "CodeCafe" },
  { value: "transparentTheme", label: "VS Code" },
];

const FONT_SIZES = [
  { value: "12", label: "Small" },
  { value: "14", label: "Medium" },
  { value: "16", label: "Large" },
  { value: "18", label: "Extra Large" },
];

const SettingsWindow: React.FC<SettingsWindowProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onLanguageChange,
  availableLanguages,
  currentTheme,
  onThemeChange,
  currentFontSize,
  onFontSizeChange,
  currentWordWrap,
  onWordWrapChange,
  currentShowLineNumbers,
  onShowLineNumbersChange,
}) => {
  // Settings state
  const [theme, setTheme] = useState(currentTheme);
  const [fontSize, setFontSize] = useState(currentFontSize);
  // Use the passed currentLanguage for initial state
  const [language, setLanguage] = useState(currentLanguage);
  // const [autoSave, setAutoSave] = useState(true);
  const [wordWrap, setWordWrap] = useState(currentWordWrap);
  const [showLineNumbers, setShowLineNumbers] = useState(
    currentShowLineNumbers
  );

  // Update local state when prop changes
  useEffect(() => {
    setLanguage(currentLanguage);
  }, [currentTheme, isOpen]);

  useEffect(() => {
    setTheme(currentTheme);
  }, [currentTheme, isOpen]);

  useEffect(() => {
    setFontSize(currentFontSize);
  }, [currentFontSize, isOpen]);

  useEffect(() => {
    setWordWrap(currentWordWrap);
  }, [currentWordWrap, isOpen]);

  useEffect(() => {
    setShowLineNumbers(currentShowLineNumbers);
  }, [currentShowLineNumbers, isOpen]);

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

  const handleClose = () => {
    onClose();
  };

  const handleSaveSettings = () => {
    // Save settings logic here
    console.log("Saving settings:", {
      theme,
      fontSize,
      language,
      // autoSave,
      wordWrap,
      showLineNumbers,
    });

    // Call the parent's onLanguageChange if language was changed
    if (language !== currentLanguage) {
      onLanguageChange(language);
    }
    if (theme !== currentTheme) {
      onThemeChange(theme as "codeCafeTheme" | "transparentTheme");
    }

    if (fontSize !== currentFontSize) {
      onFontSizeChange(fontSize); // Add this line
    }

    if (wordWrap !== currentWordWrap) {
      onWordWrapChange(wordWrap);
    }

    if (showLineNumbers !== currentShowLineNumbers) {
      onShowLineNumbersChange(showLineNumbers);
    }

    onClose();
  };

  // Toggle switch component with consistent styling
  const ToggleSwitch = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  }) => {
    return (
      <div className="flex items-center justify-between mb-4">
        <label className="text-sm font-medium text-stone-300">{label}</label>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className="relative h-[24px] w-[44px] rounded-full bg-stone-800 border border-stone-700/50 focus:outline-none transition-colors duration-300"
          style={{
            backgroundColor: checked ? "rgb(87 83 78)" : "rgb(41 37 36)",
          }}
        >
          <div
            className="absolute rounded-full bg-stone-400"
            style={{
              top: "2px",
              left: "2px",
              height: "18px",
              width: "18px",
              backgroundColor: checked
                ? "rgb(229 229 229)"
                : "rgb(168 162 158)",
              transform: checked ? "translateX(20px)" : "translateX(0px)",
              transition: "all 300ms cubic-bezier(0.4, 0.0, 0.2, 1)",
            }}
          />
        </button>
      </div>
    );
  };

  // Select component with consistent styling
  const StyledSelect = ({
    value,
    onChange,
    options,
    label,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    label: string;
  }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-stone-300 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-stone-800/50 border border-stone-700/50 text-stone-200 rounded-md px-3 py-2 focus:outline-none focus:border-stone-500 transition-colors"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
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
            className="w-full max-w-[40rem] mx-4 max-h-[90vh]"
          >
            <Card className="bg-neutral-900/80 backdrop-blur-lg border border-stone-800/50 shadow-2xl rounded-xl overflow-hidden">
              <div className="px-8 py-6 overflow-y-auto max-h-[80vh]">
                {/* Title Section */}
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold text-stone-200">
                    Settings
                  </h2>
                  <p className="text-stone-400 text-sm mt-1">
                    Customize your editor experience
                  </p>
                </div>

                {/* Settings Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  {/* Left Column */}
                  <div>
                    {/* Appearance Section */}
                    <div className="mb-6">
                      <h3 className="text-md font-medium text-stone-300 border-b border-stone-700/50 pb-2 mb-4">
                        Appearance
                      </h3>

                      <StyledSelect
                        value={theme}
                        onChange={(value: string) =>
                          setTheme(
                            value as "codeCafeTheme" | "transparentTheme"
                          )
                        }
                        options={THEMES}
                        label="Theme"
                      />

                      <StyledSelect
                        value={fontSize}
                        onChange={setFontSize}
                        options={FONT_SIZES}
                        label="Font Size"
                      />
                    </div>

                    {/* Language Section */}
                    <div className="mb-6">
                      <h3 className="text-md font-medium text-stone-300 border-b border-stone-700/50 pb-2 mb-4">
                        Language
                      </h3>

                      <StyledSelect
                        value={language}
                        onChange={setLanguage}
                        options={availableLanguages}
                        label="Editor Language"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div>
                    {/* Editor Section */}
                    <div className="mb-6">
                      <h3 className="text-md font-medium text-stone-300 border-b border-stone-700/50 pb-2 mb-4">
                        Editor
                      </h3>

                      <ToggleSwitch
                        checked={wordWrap}
                        onChange={setWordWrap}
                        label="Word Wrap"
                      />

                      <ToggleSwitch
                        checked={showLineNumbers}
                        onChange={setShowLineNumbers}
                        label="Show Line Numbers"
                      />

                      {/* <ToggleSwitch
                        checked={autoSave}
                        onChange={setAutoSave}
                        label="Auto Save"
                      /> */}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-md border border-stone-700/50 text-stone-300 hover:bg-stone-800/50 hover:text-stone-200 transition-colors"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-900 transition-colors flex items-center justify-center gap-1.5"
                    onClick={handleSaveSettings}
                  >
                    <VscCheck className="text-lg" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsWindow;
