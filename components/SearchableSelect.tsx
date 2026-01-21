import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ElementType;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Seleccionar...", 
  label,
  icon: Icon 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Sync internal state with external value prop
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If user typed something but didn't select, we might want to revert or keep it?
        // Here we keep it if it matches exactly, otherwise revert to last valid value or clear if empty
        if (value && searchTerm !== value) {
            setSearchTerm(value);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value, searchTerm]);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchTerm(option);
    setIsOpen(false);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
  };

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      {label && <label className="text-xs font-bold text-slate-600 uppercase">{label}</label>}
      
      <div className="relative">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full p-3 border rounded-lg flex items-center bg-white cursor-pointer
            ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'}
          `}
        >
          {Icon && (
            <div className="text-slate-400 mr-3 pointer-events-none">
              <Icon size={16} />
            </div>
          )}
          
          <input
            type="text"
            className="flex-grow outline-none bg-transparent placeholder-slate-400 text-slate-800"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
          />

          <div className="flex items-center gap-1">
             {value && (
                <button onClick={clearSelection} className="text-slate-300 hover:text-slate-500 p-1">
                  <X size={14} />
                </button>
             )}
             <ChevronDown size={16} className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => (
                <div 
                  key={`${option}-${idx}`}
                  onClick={() => handleSelect(option)}
                  className={`
                    px-4 py-3 text-sm cursor-pointer hover:bg-indigo-50 transition
                    ${option === value ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-700'}
                  `}
                >
                  {option}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 italic">
                No se encontraron resultados
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
