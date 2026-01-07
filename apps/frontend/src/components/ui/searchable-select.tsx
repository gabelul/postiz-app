'use client';

/**
 * Searchable Select Component
 *
 * A dropdown component with local search/filter functionality.
 * Provides a better UX for selecting from long lists of options.
 *
 * Features:
 * - Local filtering (no API calls)
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click outside to close
 * - Clear selection button
 * - Full accessibility support
 *
 * @example
 * <SearchableSelect
 *   value={selectedValue}
 *   onChange={setSelectedValue}
 *   options={[
 *     { value: 'option1', label: 'Option 1' },
 *     { value: 'option2', label: 'Option 2' },
 *   ]}
 *   placeholder="Select an option..."
 * />
 */

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useId } from 'react';

interface SearchableSelectProps {
  /** Currently selected value */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Available options */
  options: { value: string; label: string }[];
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Disable the select */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Optional id for accessibility (label association) */
  id?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  id: externalId,
}: SearchableSelectProps) {
  // Generate unique IDs for this component instance
  const uniqueId = useId();
  const inputId = externalId || `searchable-select-${uniqueId}`;
  const listId = `searchable-select-list-${uniqueId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get the currently selected option's label
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || '';

  // Filter options based on search term
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useLayoutEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      highlightedItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex].value);
        } else if (filteredOptions.length === 1) {
          selectOption(filteredOptions[0].value);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
    }
  }, [isOpen, highlightedIndex, filteredOptions]);

  // Select an option
  const selectOption = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  }, [onChange]);

  // Clear selection
  const clearSelection = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger button with input */}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          placeholder={placeholder}
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
          className={`
            w-full px-4 py-2 pr-10
            border border-newBorder rounded-lg
            bg-newBgColorInner text-newTextColor
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        />
        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-textItemBlur hover:text-newTextColor"
            aria-label="Clear selection"
            tabIndex={-1}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {/* Dropdown arrow icon (visual only, click handled by input) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-textItemBlur pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-newBgColorInner border border-newBorder rounded-lg shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <li
              role="option"
              className="px-4 py-3 text-textItemBlur text-sm"
            >
              No results found
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                onClick={() => selectOption(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  px-4 py-2 cursor-pointer text-sm
                  ${highlightedIndex === index ? 'bg-newBoxHover' : ''}
                  ${value === option.value ? 'bg-blue-500/20 text-blue-400' : 'text-newTextColor hover:bg-newBoxHover'}
                  transition-colors
                `}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
