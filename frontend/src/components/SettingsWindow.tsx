import React, { useState } from "react";
import { Card } from "@radix-ui/themes";
import { motion, AnimatePresence } from "framer-motion";
import { VscCheck } from "react-icons/vsc";
import { Switch } from "@radix-ui/react-switch";

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System Default" },
];

const FONT_SIZES = [
  { value: "12", label: "Small" },
  { value: "14", label: "Medium" },
  { value: "16", label: "Large" },
  { value: "18", label: "Extra Large" },
];

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
];

const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  // Settings state
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState("14");
  const [language, setLanguage] = useState("javascript");
  const [autoSave, setAutoSave] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const handleClose = () => {
    onClose();
  };

  const handleSaveSettings = () => {
    // Save settings logic here
    console.log("Saving settings:", {
      theme,
      fontSize,
      language,
      autoSave,
      wordWrap,
      showLineNumbers,
    });
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
  }) => (
    <div className="flex items-center justify-between mb-4">
      <label className="text-sm font-medium text-stone-300">{label}</label>
      <Switch checked={checked} onCheckedChange={onChange} className="group">
        <div className="relative h-[24px] w-[44px] cursor-pointer rounded-full bg-stone-800 border border-stone-700/50 transition-colors data-[state=checked]:bg-stone-600">
          <div className="absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-stone-400 transition-transform duration-200 data-[state=checked]:translate-x-[20px] data-[state=checked]:bg-stone-200" />
        </div>
      </Switch>
    </div>
  );

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
            className="w-full max-w-[40rem] mx-4" // Increased width from 32rem to 40rem
          >
            <Card className="bg-neutral-900/80 backdrop-blur-lg border border-stone-800/50 shadow-2xl rounded-xl overflow-visible">
              <div className="px-8 py-6">
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
                <div className="grid grid-cols-2 gap-x-10">
                  {/* Left Column */}
                  <div>
                    {/* Appearance Section */}
                    <div className="mb-6">
                      <h3 className="text-md font-medium text-stone-300 border-b border-stone-700/50 pb-2 mb-4">
                        Appearance
                      </h3>

                      <StyledSelect
                        value={theme}
                        onChange={setTheme}
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
                        options={LANGUAGES}
                        label="Default Language"
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

                      <ToggleSwitch
                        checked={autoSave}
                        onChange={setAutoSave}
                        label="Auto Save"
                      />
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
