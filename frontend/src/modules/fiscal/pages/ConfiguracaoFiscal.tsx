import { useState } from 'react';
import { SlidersHorizontal, Cloud, Scale } from 'lucide-react';
import { PageHeader } from '../../cadastros/ui';
import FiscalConfiguracao from './FiscalConfiguracao';
import MatrizFiscal from './MatrizFiscal';

type Tab = 'provedor' | 'matriz';

const TABS: [Tab, typeof Cloud, string][] = [
  ['provedor', Cloud, 'Provedor & Credenciais'],
  ['matriz', Scale, 'Matriz de Regras'],
];

/**
 * Shell da Configuração Fiscal — reúne, sob um único header e um segmentado,
 * a Central Fiscal (provedor + credenciais) e a Matriz de Regras (CFOP/CST/
 * alíquotas). Cada aba renderiza a tela real em modo `embedded` (sem header
 * próprio), então a fonte da verdade continua sendo cada componente.
 */
export default function ConfiguracaoFiscal() {
  const [tab, setTab] = useState<Tab>('provedor');
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<SlidersHorizontal className="h-4 w-4" />}
        titulo="Configuração Fiscal"
        subtitulo="Provedor, credenciais e a matriz de regras que o PDV e o atacado usam para emitir"
        actions={
          <div className="flex items-center gap-0.5 rounded-lg border border-[#23262F] bg-[#0C0D10] p-0.5">
            {TABS.map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-300 active:scale-[0.98] ${tab === id ? 'bg-[#01B8FA]/16 text-[#01B8FA]' : 'text-[#8A90A0] hover:text-[#F7F8FA]'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        {tab === 'provedor' ? <FiscalConfiguracao embedded /> : <MatrizFiscal embedded />}
      </div>
    </div>
  );
}
