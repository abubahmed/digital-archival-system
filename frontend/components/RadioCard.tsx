/**
 * Radio card component.
 *
 * Digital Archival System - The Daily Princetonian
 * Copyright © 2024-2025 The Daily Princetonian. All rights reserved.
 *
 * @file RadioCard.tsx
 */

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
}

/**
 * Radio card component.
 *
 * @param {RadioCardProps} props - The props.
 *
 * @returns {React.ReactNode} The radio card.
 */
export default function RadioCard({ name, value, checked, onChange, title, subtitle }: RadioCardProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-200 ${
        checked
          ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-blue-600"
      />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-xs text-gray-600">{subtitle}</span>
      </span>
    </label>
  );
}
