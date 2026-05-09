import { motion } from 'framer-motion';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AccessDenied = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] w-full z-20 relative px-4">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="bg-white/10 dark:bg-black/60 backdrop-blur-3xl border border-red-500/20 p-10 rounded-[3rem] shadow-[0_0_100px_rgba(239,68,68,0.1)] flex flex-col items-center text-center max-w-lg w-full relative overflow-hidden"
            >
                {/* Ecto/Aura effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/10 blur-[80px] rounded-full pointer-events-none"></div>

                <motion.div 
                    animate={{ rotate: [-5, 5, -5, 5, 0], x: [-5, 5, -5, 5, 0] }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center mb-6 relative"
                >
                    <Lock className="w-16 h-16 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute bottom-2 right-2 bg-background rounded-full p-1"
                    >
                        <ShieldAlert className="w-8 h-8 text-secondary" />
                    </motion.div>
                </motion.div>

                <h1 className="text-3xl font-black text-text dark:text-gray-200 mb-2">Acceso Restringido</h1>
                <p className="text-text/60 dark:text-gray-400 font-bold mb-8">
                    Ups, tu credencial ha sido validada pero careces de los privilegios modulares para transitar en este sector operativo.
                </p>

                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/')} 
                    className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 transition-all font-black px-6 py-4 rounded-xl flex items-center justify-center gap-2 group shadow-xl"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Retornar al Dashboard Seguro
                </motion.button>
            </motion.div>
        </div>
    );
};
