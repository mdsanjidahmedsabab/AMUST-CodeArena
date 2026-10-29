/**
 * components/OtpInput.jsx
 * ───────────────────────
 * 6-Digit Segmented Numeric OTP Input Component with Auto-Advance & Paste Support.
 */

import { useRef, useEffect } from 'react';

export default function OtpInput({
  value = '',
  onChange,
  disabled = false,
  hasError = false,
  length = 6,
}) {
  const inputRefs = useRef([]);

  // Initialize inputRefs array length
  inputRefs.current = inputRefs.current.slice(0, length);

  const digits = value.split('').slice(0, length);
  while (digits.length < length) {
    digits.push('');
  }

  // Auto focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [disabled]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    const char = val.slice(-1); // Take latest typed character

    if (char && !/^\d$/.test(char)) return; // Allow only digits

    const newDigits = [...digits];
    newDigits[index] = char;
    const combined = newDigits.join('');
    onChange && onChange(combined);

    // Auto-advance to next input if digit entered
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and clear previous input
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange && onChange(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange && onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    const numericChars = pasteData.replace(/\D/g, '').slice(0, length);

    if (numericChars) {
      onChange && onChange(numericChars);
      const targetIndex = Math.min(numericChars.length, length - 1);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          className={`w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border transition-all duration-200 outline-none select-none ${
            hasError
              ? 'border-rose-500 bg-rose-950/20 text-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
              : digits[i]
              ? 'border-emerald-500/80 bg-slate-900 text-emerald-400 shadow-sm shadow-emerald-500/10'
              : 'border-slate-700 bg-slate-950 text-slate-100 hover:border-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
          }`}
        />
      ))}
    </div>
  );
}
