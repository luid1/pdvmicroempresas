import { FlaskConical } from 'lucide-react';

/**
 * Selo "MODO SIMULAÇÃO — sem valor fiscal" (Frente F.1).
 * Exibido em toda tela fiscal que ainda NÃO integra com a SEFAZ de verdade
 * (emissão de NF-e, MDF-e, CT-e), para evitar confusão operacional.
 *
 * variant "banner"  → faixa larga no topo da tela.
 * variant "chip"    → etiqueta compacta para cabeçalhos/linhas.
 */
export default function SeloSimulacao({
  variant = 'banner',
  texto = 'MODO SIMULAÇÃO — sem valor fiscal',
  detalhe,
}: {
  variant?: 'banner' | 'chip';
  texto?: string;
  detalhe?: string;
}) {
  if (variant === 'chip') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
        <FlaskConical className="h-3 w-3" /> Simulação
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-amber-400/10 border-b border-amber-400/25 text-amber-200 px-4 py-2 text-xs font-semibold">
      <FlaskConical className="h-4 w-4 shrink-0 text-amber-300" />
      <span className="uppercase tracking-wide">{texto}</span>
      {detalhe && <span className="font-normal text-amber-200/70 normal-case">· {detalhe}</span>}
    </div>
  );
}
