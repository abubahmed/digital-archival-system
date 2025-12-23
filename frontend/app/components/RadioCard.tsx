interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}

export default function RadioCard({ name, value, checked, onChange, title, subtitle }: RadioCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
        checked ? "border-black bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1" />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-xs text-gray-600">{subtitle}</span>
      </span>
    </label>
  );
}

