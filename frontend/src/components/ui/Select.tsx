const Select = ({
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

export default Select;
