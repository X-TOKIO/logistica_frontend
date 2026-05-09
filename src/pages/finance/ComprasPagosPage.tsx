import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { financeApi } from '../../services/finance';
import { CreditCard, CheckCircle, Clock, ShoppingCart, Building } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const ComprasPagosPage = () => {
   const [cuentas, setCuentas] = useState<any[]>([]);
   const [searchParams] = useSearchParams();
   const q = searchParams.get('q');

   const loadCuentas = async () => {
       try { setCuentas(await financeApi.getCuentas()); } catch(e) { console.error(e); }
   };
   
   useEffect(() => { loadCuentas(); }, []);

   const handlePagar = async (idPago: number, idCuota: number) => {
       if (window.confirm('¿Está seguro de emitir dictamen PAGADO a esta cuota?')) {
           try {
               await financeApi.pagarCuota(idPago, idCuota);
               toast.error('Cuota liquidada contra Base de Datos.');
               loadCuentas();
           } catch(e) { toast.error('Error transaccional al pagar'); }
       }
   };

   // Agrupando cuentas a Nivel Visual
   const filteredCuentas = q 
     ? cuentas.filter(c => c.pago.notaCompra.ID_Compra.toString() === q.replace('COMP-','') || c.pago.notaCompra.proveedor.NIT.includes(q)) 
     : cuentas;

   // Agrupamos por ID_Pago (que equivale a la Compra)
   const grupos: { [key: number]: any[] } = {};
   filteredCuentas.forEach(c => {
       if (!grupos[c.pago.ID_Pago]) grupos[c.pago.ID_Pago] = [];
       grupos[c.pago.ID_Pago].push(c);
   });

   return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">
      <h2 className="text-4xl font-black text-secondary drop-shadow-sm flex items-center gap-3 decoration-wavy">
        <CreditCard className="w-10 h-10"/> Auditoría de Cuentas por Pagar
      </h2>

      <div className="grid grid-cols-1 gap-8 mt-4">
         {Object.keys(grupos).length === 0 && <span className="opacity-50 p-10 block font-bold text-center">No existen deudas registradas a la fecha actual.</span>}
         
         {Object.keys(grupos).map(pagoId => {
             const items = grupos[Number(pagoId)];
             const compra = items[0].pago.notaCompra;
             const prov = compra.proveedor;
             const plazoLiquidado = items.filter(i => i.Estado === 'PAGADO').length;

             return (
                 <div key={pagoId} className="bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-6">
                    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/10 blur-[100px] rounded-full pointer-events-none"></div>
                    
                    {/* Tarjeta de Resumen Compra */}
                    <div className="md:w-1/3 bg-background/50 rounded-2xl p-6 border border-black/5 shadow-inner">
                       <h3 className="font-black text-xl text-primary flex items-center gap-2 mb-2"><ShoppingCart className="w-5 h-5"/> COMP-{compra.ID_Compra}</h3>
                       <p className="text-xs font-bold opacity-60 mb-4">{new Date(compra.Fecha_Emision ?? compra.Fecha).toLocaleDateString()}</p>

                       <div className="bg-secondary/10 text-secondary p-4 rounded-xl border border-secondary/20 mb-4">
                          <p className="text-[10px] uppercase font-black tracking-widest mb-1">Costo Capital Inyectado</p>
                          <p className="text-3xl font-black">Bs. {compra.Monto_Total ?? compra.MontoTotal}</p>
                       </div>

                       <div className="flex items-center gap-3">
                           <Building className="w-8 h-8 text-secondary p-1.5 bg-black/5 rounded-lg"/>
                           <div>
                              <p className="font-bold text-sm leading-tight">{prov.Nombre}</p>
                              <p className="text-[10px] opacity-70 font-mono tracking-widest">NIT: {prov.NIT}</p>
                           </div>
                       </div>
                    </div>

                    {/* Línea de Tiempo de Cuotas */}
                    <div className="flex-1">
                       <h4 className="font-black text-sm uppercase tracking-widest mb-4 opacity-70 border-b border-black/10 pb-2 flex justify-between">
                          Desglose de Amortización (Plan Pagos)
                          <span className="text-secondary font-black bg-secondary/10 px-3 py-1 rounded-full text-[10px]">Progreso {plazoLiquidado}/{items.length}</span>
                       </h4>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {items.map(cuota => {
                              const isPagado = cuota.Estado === 'PAGADO';
                              return (
                                 <div key={cuota.ID_Cuota} className={`rounded-xl p-4 border-l-4 shadow-sm transition-all ${isPagado ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                       <span className="font-black text-xs opacity-70">CUOTA #{cuota.ID_Cuota}</span>
                                       {isPagado ? <CheckCircle className="w-5 h-5 text-green-500"/> : <Clock className="w-5 h-5 text-red-500"/>}
                                    </div>
                                    <p className={`text-xl font-black mb-1 ${isPagado ? 'text-green-600' : 'text-red-500'}`}>Bs. {cuota.Monto}</p>
                                    <p className="text-[10px] font-bold opacity-60 mb-3">Vence: {new Date(cuota.Fecha).toLocaleDateString()}</p>
                                    
                                    {!isPagado && (
                                       <button onClick={() => handlePagar(cuota.ID_Pago, cuota.ID_Cuota)} className="w-full py-2 bg-red-500 hover:bg-black text-white font-black text-xs uppercase rounded-lg shadow-md transition-colors">
                                          Pagar Ahora
                                       </button>
                                    )}
                                    {isPagado && (
                                       <div className="w-full py-2 bg-green-500/20 text-green-600 border border-green-500/10 font-black text-[10px] uppercase rounded-lg text-center">
                                          Totalmente Liquidado
                                       </div>
                                    )}
                                 </div>
                              )
                          })}
                       </div>
                    </div>

                 </div>
             )
         })}
      </div>
    </div>
   );
};
