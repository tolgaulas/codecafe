import { useState, useEffect } from "react";

interface SwitchProps {
  isOn: boolean;
  handleToggle: (value: boolean) => void;
  label?: string;
}

export default function ToggleSwitch({
  isOn,
  handleToggle,
  label,
}: SwitchProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // Set a delay before enabling animation to avoid initial load animation
    const timeoutId = setTimeout(() => setShouldAnimate(true), 300);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex items-center justify-between mb-4">
      {label && (
        <label className="text-sm font-medium text-stone-300">{label}</label>
      )}
      <div
        onClick={() => handleToggle(!isOn)}
        className={`relative flex items-center h-6 w-11 rounded-full cursor-pointer border border-stone-700/50 ${
          isOn ? "bg-stone-600" : "bg-stone-800"
        } transition-colors duration-300 ease-in-out`}
      >
        <span
          className={`absolute left-[1px] h-5 w-5 rounded-full ${
            isOn ? "bg-stone-200" : "bg-stone-400"
          }`}
          style={{
            transform: isOn ? "translateX(20px)" : "translateX(0px)",
            transition: shouldAnimate ? "all 300ms ease-in-out" : "none",
          }}
        />
      </div>
    </div>
  );
}
