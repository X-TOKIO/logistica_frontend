import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi } from '../../services/inventory';
import { warehouseApi } from '../../services/warehouse';
import { AlertTriangle, Plus, Search, Trash2, FileWarning, Printer } from 'lucide-react';

export const MermasPage = () => {
    const { user } = useAuth();
    const [mermas, setMermas] = useState<any[]>([]);
    const [almacenes, setAlmacenes] = useState<any[]>([]);

    // Atributos fieles a la BD
    const [motivoPerdida, setMotivoPerdida] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    const getCurrentTime = () => {
        const now = new Date();
        return now.toTimeString().slice(0, 5);
    };
    const [hora, setHora] = useState(getCurrentTime());

    const [detalles, setDetalles] = useState<any[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const load = async () => {
        try {
            setMermas(await inventoryApi.getMermas());
            setAlmacenes(await warehouseApi.getAlmacenes());
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (searchTerm.trim().length > 1) setSearchResults(await warehouseApi.getProductos(searchTerm));
            else setSearchResults([]);
        }, 400);
        return () => clearTimeout(delay);
    }, [searchTerm]);

    const resolveImg = (imgPath: string | undefined) => {
        if (!imgPath) return null;
        if (imgPath.startsWith('data:') || imgPath.startsWith('http')) return imgPath;
        return `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
    };

    const addDetalle = (prod: any) => {
        const idReal = prod.ID_Producto || prod.id;
        const nombreReal = prod.Nombre || prod.nombre;
        const codigoReal = prod.CodigoBarra || prod.codigo || 'S/N';
        const stockReal = prod.productoAlmacenes ? prod.productoAlmacenes.reduce((acc: any, pa: any) => acc + Number(pa.Stock_Actual), 0) : (prod.Stock_Actual || prod.stock || 0);

        const exists = detalles.find(d => d.ID_Producto === idReal && d.ID_Almacen === almacenes[0]?.ID_Almacen);

        if (!exists) {
            setDetalles([...detalles, {
                ID_Producto: idReal,
                Cantidad: 1,
                ID_Almacen: almacenes[0]?.ID_Almacen || '',
                _nombre: nombreReal,
                _codigo: codigoReal,
                _stockFisico: stockReal,
            }]);
        } else {
            toast.warning('El producto ya está en la lista de merma.');
        }
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeRow = (index: number) => setDetalles(detalles.filter((_, i) => i !== index));

    const updateRow = (index: number, field: string, value: any) => {
        const arr = [...detalles];
        arr[index] = { ...arr[index], [field]: value };
        setDetalles(arr);
    };

    const handleSave = async () => {
        if (detalles.length === 0) return toast.error('Debes añadir al menos un producto a mermar.');
        if (!motivoPerdida.trim()) return toast.error('El motivo de pérdida es obligatorio.');

        // Payload limpio
        const detallesLimpios = detalles.map(d => ({
            ID_Producto: Number(d.ID_Producto),
            ID_Almacen: Number(d.ID_Almacen),
            Cantidad: Number(d.Cantidad)
        }));

        try {
            await inventoryApi.createMerma({
                MotivoPerdida: motivoPerdida,
                Fecha: fecha,

                detalles: detallesLimpios,
            });
            setMotivoPerdida('');
            setDetalles([]);
            toast.success('¡Control de Merma Registrado!');
            load();
        } catch (e: any) {
            console.error('Error mermas:', e.response?.data);
            toast.error(e.response?.data?.message || 'Error al guardar la merma.');
        }
    };

    const exportPDFGlobal = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Membrete Corporativo
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("PARADISO", 15, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Logística y Distribución", 15, 26);

        // Título del Documento
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("REPORTE GLOBAL DE MERMAS", pageWidth / 2, 40, { align: "center" });

        // Metadatos
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 15, 50);

        const tableData = mermas.map((e: any, index: number) => {
            const emp = e.empleado;
            const usr = emp?.usuario;
            const username = usr?.Username || usr?.username || emp?.Username || emp?.username || '';
            const nombreEmp = emp ? `${emp.Nombre || emp.nombre || ''} ${emp.Apellido || emp.apellido || ''}`.trim() : '';
            const operadorGlobal = emp ? `${nombreEmp} (${username})`.trim() : 'Sistema';

            return [
                index + 1,
                `MRM-${e.ID_Merma.toString().padStart(5, '0')}`,
                new Date(e.Fecha).toLocaleDateString() + ' ' + e.Hora,
                operadorGlobal,
                e.MotivoPerdida || 'Sin detalle'
            ];
        });

        autoTable(doc, {
            startY: 55,
            head: [['N°', 'Comprobante', 'Fecha / Hora', 'Operador', 'Motivo']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] }
        });

        doc.save(`Reporte_Global_Mermas_${new Date().getTime()}.pdf`);
    };

    const exportPDFIndividual = (nota: any) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Membrete Corporativo
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("PARADISO", 15, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Logística y Distribución", 15, 26);

        // Título del Documento
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`COMPROBANTE DE MERMA N° ${nota.ID_Merma.toString().padStart(5, '0')}`, pageWidth / 2, 40, { align: "center" });

        // Bloque de Metadatos (Auditoría)
        doc.setFontSize(10);
        const fechaFormat = new Date(nota.Fecha).toLocaleDateString();
        doc.text(`Fecha y Hora: ${fechaFormat} - ${nota.Hora}`, 15, 50);

        // Operador
        const emp = nota.empleado;
        const nombreEmp = emp ? `${emp.Nombre || emp.nombre || ''} ${emp.Apellido || emp.apellido || ''}`.trim() : user?.username || 'Operador';
        const ciEmp = emp ? (emp.CI || emp.ci || '') : '';
        const operadorTexto = emp ? `${nombreEmp} (CI: ${ciEmp})` : `${user?.username || 'Sistema'} (Sesión Actual)`;

        doc.text(`Responsable/Operador: ${operadorTexto}`, 15, 57);

        const maxDescWidth = pageWidth - 30;
        const descLines = doc.splitTextToSize(`Concepto/Motivo: ${nota.MotivoPerdida || 'Sin descripción'}`, maxDescWidth);
        doc.text(descLines, 15, 64);

        let currentY = 64 + (descLines.length * 5);

        // Tabla Principal
        const filas = nota.detalles?.map((d: any, index: number) => [
            index + 1,
            d.producto?.CodigoBarra || d.producto?.codigo || 'S/N',
            d.producto?.Nombre || d.producto?.nombre || 'Artículo',
            Number(d.Cantidad || d.cantidad).toFixed(2),
            d.producto?.medida?.Nombre || d.producto?.medida?.nombre || 'Uds',
            `Bs. ${Number(d.producto?.PrecioUnitario || d.producto?.precio || 0).toFixed(2)}`,
            d.ID_Almacen || d.idAlmacen || '1'
        ]) || [];

        autoTable(doc, {
            startY: currentY + 5,
            head: [['N°', 'Código', 'Descripción del Artículo', 'Cantidad', 'Unidad', 'Precio U.', 'Almacén']],
            body: filas,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] } // Oscuro contable
        });

        const finalY = (doc as any).lastAutoTable.finalY || currentY + 10;

        // Pie de Página (Firmas)
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const signatureY = finalY + 30;
        doc.line(20, signatureY, 80, signatureY);
        doc.text(`Entregué Conforme (${operadorTexto})`, 50, signatureY + 5, { align: 'center' });

        doc.line(pageWidth - 80, signatureY, pageWidth - 20, signatureY);
        doc.text("Recibí / Revisado Por", pageWidth - 50, signatureY + 5, { align: 'center' });

        doc.save(`Comprobante-Merma-${nota.ID_Merma.toString().padStart(5, '0')}.pdf`);
    };

    return (
        <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-4xl font-black text-orange-600 dark:text-orange-400 drop-shadow-sm flex items-center gap-2">
                    Control: Merma / Descarte
                </h2>
                <button onClick={exportPDFGlobal} className="bg-orange-500/10 text-orange-500 px-3 sm:px-4 py-2 sm:py-2.5 rounded-md hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-2 font-bold shadow-sm border border-orange-500/20 text-sm">
                    <Printer className="w-4 h-4" /> Exportar PDF
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-2">
                <div className="bg-card border border-orange-500/20 rounded-md p-4 sm:p-8 shadow-xl relative h-max">
                    <div className="absolute inset-0 overflow-hidden rounded-md pointer-events-none">
                        <div className="absolute top-0 right-0 w-60 h-60 bg-orange-500/10 blur-[80px] rounded-full"></div>
                    </div>
                    <h3 className="text-2xl font-black text-text mb-6">Declaración de Baja</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-2 ring-orange-500 border border-divider font-medium" />
                        <input type="time" required value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-2 ring-orange-500 border border-divider font-medium" />
                    </div>
                    <input
                        required
                        placeholder="Describe detalladamente el motivo de la baja..."
                        value={motivoPerdida}
                        onChange={e => setMotivoPerdida(e.target.value)}
                        className="w-full bg-surface rounded-md px-4 py-4 outline-none focus:ring-2 ring-orange-500 border border-divider font-medium mb-4"
                    />

                    <div className="mb-6 relative z-30">
                        <label className="text-[10px] tracking-widest font-black uppercase text-orange-500 opacity-60 mb-2 block">Extracción de Ítem (Validador de Cantidad)</label>
                        <div className="flex items-center bg-surface rounded-md px-4 py-3 border border-divider focus-within:border-orange-500 transition-all">
                            <Search className="w-5 h-5 text-orange-500 mr-2" />
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar producto afectado..." className="bg-transparent border-none outline-none w-full font-bold" />
                        </div>

                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-card border border-divider rounded-md shadow-2xl mt-2 overflow-hidden z-40 max-h-[300px] overflow-y-auto">
                                {searchResults.map((p, index) => {
                                    const idReal = p.ID_Producto || p.id || index;
                                    const nombreReal = p.Nombre || p.nombre;
                                    const codigoReal = p.CodigoBarra || p.codigo || 'S/N';
                                    const imgUrl = p.Image ? resolveImg(p.Image) : null;
                                    const stockReal = p.productoAlmacenes ? p.productoAlmacenes.reduce((acc: any, pa: any) => acc + Number(pa.Stock_Actual), 0) : (p.Stock_Actual || p.stock || 0);

                                    return (
                                        <div key={idReal} onClick={() => addDetalle(p)} className="flex items-center gap-4 p-3 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer border-b border-black/5">
                                            <div className="w-10 h-10 bg-orange-500/10 rounded-md overflow-hidden flex items-center justify-center text-orange-500 font-black text-xs shrink-0">
                                                {imgUrl ? <img src={imgUrl} className="w-full h-full object-cover" /> : 'IMG'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-sm leading-tight text-text">{nombreReal}</p>
                                                <p className="text-[10px] uppercase font-black opacity-60 mt-0.5">
                                                    Stock Gbl: <span className={`mx-1 text-sm ${stockReal > 0 ? 'text-green-500' : 'text-red-500'}`}>{stockReal}</span> | UUID: {codigoReal}
                                                </p>
                                            </div>
                                            <Plus className="w-5 h-5 text-orange-500" />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {detalles.length > 0 && (
                        <div className="border border-orange-500/20 rounded-md overflow-hidden mb-6 bg-card">
                            <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm min-w-[400px]">
                                <thead className="bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                    <tr>
                                        <th className="p-3 text-xs uppercase font-black">Producto</th>
                                        <th className="p-3 w-28 text-xs uppercase font-black text-center">Cantidad</th>
                                        <th className="p-3 w-36 text-xs uppercase font-black">Almacén Origen</th>
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {detalles.map((d, i) => (
                                        <tr key={i} className={`hover:bg-black/5 ${d.Cantidad > d._stockFisico ? 'bg-red-500/20' : ''}`}>
                                            <td className="p-3 font-bold text-xs">{d._nombre}</td>
                                            <td className="p-3">
                                                <input type="number" min="0.1" step="0.1" value={d.Cantidad} onChange={e => updateRow(i, 'Cantidad', e.target.value)} className="w-full bg-background border border-black/10 rounded-md px-2 py-1 outline-none focus:ring-1 ring-orange-500 font-mono font-bold text-center text-orange-500" />
                                            </td>
                                            <td className="p-3">
                                                <select value={d.ID_Almacen} onChange={e => updateRow(i, 'ID_Almacen', e.target.value)} className="w-full bg-background border border-black/10 rounded-md px-1 py-1 outline-none text-[10px] font-black uppercase">
                                                    {almacenes.map(a => <option key={a.ID_Almacen} value={a.ID_Almacen}>{a.Nombre}</option>)}
                                                </select>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 bg-red-500/10 p-1.5 rounded-md"><Trash2 className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}

                    <button onClick={handleSave} className="w-full bg-orange-500 text-white font-black uppercase tracking-wider py-4 rounded-md flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:brightness-110 active:scale-95 transition-all">
                        <FileWarning className="w-5 h-5" /> Ejecutar Baja de Inventario
                    </button>
                </div>

                {/* Histórico */}
                <div className="bg-card border border-divider rounded-md p-6 shadow-sm flex flex-col gap-4 overflow-y-auto max-h-[800px]">
                    <h3 className="text-lg font-black text-text mb-2 sticky top-0 bg-card/95 p-2 backdrop-blur-md rounded-md z-20 border-b border-divider">Histórico de Mermas</h3>
                    {mermas.map(nota => (
                        <div key={nota.ID_Merma} className="bg-background rounded-md p-5 border border-divider flex flex-col gap-3 relative hover:-translate-y-0.5 transition-transform border-l-4 border-l-orange-500 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-black text-orange-500 text-lg tracking-widest">MRM-{nota.ID_Merma.toString().padStart(5, '0')}</h4>
                                    <p className="text-[10px] font-black uppercase opacity-50">{new Date(nota.Fecha).toLocaleDateString()} - <span className="text-secondary">{nota.Hora}</span></p>
                                </div>
                                <div className="flex gap-2">
                                                    <button onClick={() => exportPDFIndividual(nota)} className="bg-primary/10 text-primary px-3 py-1 rounded hover:bg-primary hover:text-white transition-colors flex items-center gap-1.5 font-bold text-[10px]">
                                        <Printer className="w-3.5 h-3.5" /> IMPRIMIR COMPROBANTE
                                    </button>
                                    <div className="bg-[#2b2000] text-[#d89614] px-3 py-1 rounded text-[10px] font-black border border-[#d89614] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> DESTRUIDO</div>
                                </div>
                            </div>
                            <p className="text-sm font-medium leading-relaxed italic opacity-80">"{nota.MotivoPerdida}"</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};