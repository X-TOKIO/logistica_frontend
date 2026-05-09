import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

export const Footer = () => {
  const location = useLocation();
  const [visitas, setVisitas] = useState<number>(0);

  useEffect(() => {
    // Carga inicial del contador para la ruta actual (sin incrementar)
    api
      .get(`/common/visitas?path=${encodeURIComponent(location.pathname)}`)
      .then(res => setVisitas(res.data.total_visitas ?? 0))
      .catch(() => null);

    // Escucha el evento que RouteChangeListener dispara tras el POST de incremento
    const handler = (e: Event) => {
      const count = (e as CustomEvent<{ count: number }>).detail?.count;
      if (count !== undefined) setVisitas(count);
    };

    window.addEventListener('visit-registered', handler);
    return () => window.removeEventListener('visit-registered', handler);
  }, [location.pathname]);

  return (
    <footer className="flex justify-between items-center p-4 border-t border-black/10 dark:border-white/10 bg-background mt-auto transition-colors duration-300">
      <div className="text-sm font-medium opacity-60">PARADISO Logistics © 2026</div>
      <div className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 px-4 py-1.5 rounded-full">
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        Visitas en este módulo: {visitas}
      </div>
    </footer>
  );
};
