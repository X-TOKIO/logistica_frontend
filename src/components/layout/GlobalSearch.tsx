import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Package, Building2, Users, Truck, ShoppingCart, Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../services/search';
import type { GlobalSearchResult, SearchResultItem } from '../../services/search';

// ── Metadatos de cada sección ──────────────────────────────────────────────

const SECTIONS = {
  productos:   { label: 'Productos',   Icon: Package,      color: 'text-blue-400'    },
  proveedores: { label: 'Proveedores', Icon: Building2,    color: 'text-emerald-400' },
  empleados:   { label: 'Empleados',   Icon: Users,        color: 'text-violet-400'  },
  despachos:   { label: 'Despachos',   Icon: Truck,        color: 'text-amber-400'   },
  compras:     { label: 'Compras',     Icon: ShoppingCart, color: 'text-rose-400'    },
} as const;

type Section = keyof typeof SECTIONS;

// ── Componente ─────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  autoFocus?: boolean;
  onSelect?:  () => void;
  className?: string;
}

export const GlobalSearch = ({ autoFocus, onSelect, className = '' }: GlobalSearchProps) => {
  const [q,       setQ]       = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<ReturnType<typeof setTimeout>>();
  const navigate     = useNavigate();

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const data = await searchApi.global(term);
      setResults(data);
      setOpen(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    clearTimeout(timerRef.current);

    if (val.trim().length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setQ('');
      setResults(null);
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    setQ('');
    setResults(null);
    onSelect?.();
    navigate(item.url);
  };

  const hasResults = results
    ? Object.values(results).some(arr => arr.length > 0)
    : false;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center bg-surface rounded-md px-4 py-2.5 border transition-all ${
        open
          ? 'border-primary/60 ring-2 ring-primary/20'
          : 'border-divider focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20'
      }`}>
        {loading
          ? <Loader2 className="h-5 w-5 text-primary flex-shrink-0 animate-spin" />
          : <Search  className="h-5 w-5 text-primary flex-shrink-0" />
        }
        <input
          autoFocus={autoFocus}
          type="text"
          placeholder="Buscar en todo el sistema..."
          className="bg-transparent border-none outline-none ml-2 w-full text-sm text-text font-bold placeholder-gray-500"
          value={q}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (hasResults) setOpen(true); }}
        />
      </div>

      {/* ── Dropdown ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={   { opacity: 0, y: 4,  scale: 0.98 }}
            transition={{ duration: 0.13 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border border-divider rounded-md shadow-2xl z-50 overflow-hidden max-h-[480px] overflow-y-auto"
          >
            {!hasResults ? (
              <div className="px-4 py-6 text-center text-sm text-muted">
                Sin resultados para{' '}
                <span className="text-text font-bold">"{q}"</span>
              </div>
            ) : (
              (Object.keys(SECTIONS) as Section[]).map(section => {
                const items = results![section];
                if (!items?.length) return null;

                const { label, Icon, color } = SECTIONS[section];

                return (
                  <div key={section}>
                    {/* Encabezado de sección */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-surface/60 border-b border-t border-divider sticky top-0">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                        {label}
                      </span>
                      <span className="ml-auto text-[10px] font-bold text-muted bg-background px-1.5 py-0.5 rounded">
                        {items.length}
                      </span>
                    </div>

                    {/* Filas */}
                    {items.map(item => (
                      <button
                        key={item.id}
                        className="w-full flex flex-col items-start px-5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors border-b border-divider/40 last:border-0 text-left"
                        onClick={() => handleSelect(item)}
                      >
                        <span className="text-sm font-bold text-text truncate w-full">
                          {item.label}
                        </span>
                        <span className="text-xs text-muted truncate w-full">
                          {item.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-divider bg-surface/40 flex items-center gap-1">
              <Search className="w-3 h-3 text-muted" />
              <span className="text-[10px] text-muted">
                Mostrando hasta 5 resultados por módulo · Esc para cerrar
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
