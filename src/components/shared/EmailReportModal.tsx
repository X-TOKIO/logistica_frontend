import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, X, FileText, SlidersHorizontal } from 'lucide-react';

interface EmailReportModalProps {
  open: boolean;
  onClose: () => void;
  reportTitle: string;
  reportSubtitle: string;
  pdfInfoText?: string;
  pdfInfoSub?: string;
  filters?: { label: string; value: string }[];
  onSend: (email: string, message: string) => Promise<void> | void;
  sending?: boolean;
}

export function EmailReportModal({
  open,
  onClose,
  reportTitle,
  reportSubtitle,
  pdfInfoText = 'Se generará un PDF con los filtros activos',
  pdfInfoSub  = 'Incluye tabla del periodo seleccionado',
  filters,
  onSend,
  sending = false,
}: EmailReportModalProps) {
  const [email,    setEmail]    = useState('');
  const [message,  setMessage]  = useState('');
  const [emailErr, setEmailErr] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { setEmailErr(true); return; }
    setEmailErr(false);
    await onSend(email.trim(), message.trim());
  };

  const handleClose = () => {
    if (sending) return;
    setEmail('');
    setMessage('');
    setEmailErr(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#111827' }}
          >
            {/* Header */}
            <div
              className="relative px-6 py-5"
              style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%)' }}
            >
              <h2 className="text-[15px] font-bold text-white">Enviar Reporte por Correo</h2>
              <p className="text-xs text-blue-200 mt-0.5">{reportTitle} · {reportSubtitle}</p>
              <button
                onClick={handleClose}
                disabled={sending}
                className="absolute top-3.5 right-4 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">

              {/* Filtros activos */}
              {filters && filters.length > 0 && (
                <div className="rounded-xl bg-gray-800/60 border border-amber-500/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 tracking-widest uppercase">Filtros aplicados al reporte</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filters.map(f => (
                      <div key={f.label} className="flex items-center gap-1.5 text-xs bg-gray-900/60 border border-gray-700 rounded-lg px-2.5 py-1">
                        <span className="text-gray-500">{f.label}:</span>
                        <span className="text-amber-300 font-semibold">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 tracking-widest uppercase">
                  Correo Destinatario <span className="text-orange-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(false); }}
                  placeholder="ejemplo@correo.com"
                  className={[
                    'w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors',
                    'bg-gray-800/80 text-gray-100 placeholder:text-gray-500',
                    emailErr
                      ? 'border-2 border-orange-500'
                      : 'border border-gray-700 focus:border-orange-500',
                  ].join(' ')}
                />
                {emailErr && (
                  <p className="text-[11px] text-orange-400 mt-1">El correo es obligatorio.</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 mb-1.5 tracking-widest uppercase">
                  Mensaje Personalizado{' '}
                  <span className="text-gray-600 normal-case font-normal tracking-normal">(Opcional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Escribe una nota o deja en blanco para usar el mensaje predeterminado..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm bg-gray-800/80 border border-gray-700 text-gray-100 placeholder:text-gray-500 outline-none focus:border-gray-500 resize-none transition-colors"
                />
              </div>

              {/* Info card */}
              <div className="flex items-start gap-3 rounded-xl bg-gray-800/60 border border-gray-700/60 p-4">
                <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-200">{pdfInfoText}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pdfInfoSub}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleClose}
                  disabled={sending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <Mail className={`w-4 h-4 ${sending ? 'animate-ping' : ''}`} />
                  {sending ? 'Enviando...' : 'Enviar correo'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
