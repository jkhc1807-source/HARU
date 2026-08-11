"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export type ChoiceOption = { value: string; label: string };

export function ChoiceSelect({ value, options, placeholder = "", ariaLabel, disabled = false, className = "", onChange }: {
  value: string;
  options: ChoiceOption[];
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(0, options.findIndex(option => option.value === value));
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
    onChange(options[nextIndex].value);
    setIsOpen(true);
  }

  return <div ref={rootRef} className={`choice-select ${isOpen ? "is-open" : ""} ${className}`}>
    <button ref={triggerRef} type="button" className="choice-select-trigger" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)} onKeyDown={handleKeyDown}>
      <span>{selected?.label || placeholder}</span><i aria-hidden="true" />
    </button>
    {isOpen && <div className="choice-select-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option, index) => <button ref={element => { optionRefs.current[index] = element; }} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "selected" : ""} key={option.value} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setIsOpen(false); triggerRef.current?.focus(); } else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); optionRefs.current[Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus(); } }} onClick={() => { onChange(option.value); setIsOpen(false); triggerRef.current?.focus(); }}>{option.label}</button>)}
    </div>}
  </div>;
}
