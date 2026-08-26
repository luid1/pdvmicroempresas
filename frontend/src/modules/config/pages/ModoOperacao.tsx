import { useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { SEGMENTOS, type Segmento } from '../../../config/segmentos';
import { toast } from '../../../components/ui/feedback';

/**
 * MODO DE OPERAÇÃO (multissegmento) — o dono escolhe o tipo principal do
 * negócio. Isso controla quais telas, atalhos e dashboards aparecem. Pode ser
 * alterado a qualquer momento. Persistido server-side (empresa/tenant); só ADMIN.
 */
export default function ModoOperacao() {
  const { segmento: atual, setSegmento, user } = useAuth();
  const [escolhido, setEscolhido] = useState<Segmento>(atual);
  const [salvando, setSalvando] = useState(false);
  const ehAdmin = user?.role === 'ADMIN';
  const mudou = escolhido !== atual;

  const salvar = async () => {
    if (!ehAdmin) {
      toast('Só o ADMIN da empresa pode alterar o modo de operação.', 'error');
      return;
    }
    setSalvando(true);
    try {
      await setSegmento(escolhido);
      toast('Modo de operação atualizado. O menu já se ajustou.', 'success');
    } catch (e: any) {
      toast(e?.response?.data?.error?.message || 'Não foi possível salvar o modo agora.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="bg-[#101216] border-b border-[#23262F] px-5 py-3 shrink-0">
        <h1 className="text-[15px] font-bold text-[#16171D] leading-tight">Modo de Operação</h1>
        <p className="text-xs text-[#8B8D98]">
          Escolha o tipo principal do seu negócio. O Lumin adapta menus e recursos automaticamente.
        </p>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-4xl">
          <div className="grid gap-4 md:grid-cols-3">
            {SEGMENTOS.map((s) => {
              const ativo = escolhido === s.key;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  onClick={() => setEscolhido(s.key)}
                  className={`text-left rounded-2xl border p-5 transition-all ${
                    ativo
                      ? 'border-[#01B8FA] bg-[#01B8FA]/[0.06] shadow-[0_10px_30px_-16px_rgba(1,184,250,0.6)]'
                      : 'border-[#E7E5DF] bg-[#101216] hover:border-[#01B8FA]/40 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                      ativo ? 'bg-[#01B8FA] text-white' : 'bg-[#F1F1F3] text-[#5B5D69]'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {ativo && (
                      <span className="h-6 w-6 rounded-full bg-[#01B8FA] text-white flex items-center justify-center">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-bold text-[#16171D]">{s.label}</h3>
                  <p className="mt-1 text-sm text-[#5B5D69] leading-relaxed">{s.descricao}</p>
                  <p className="mt-2 text-xs text-[#8B8D98] leading-relaxed">{s.exemplos}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={salvar}
              disabled={!mudou || salvando || !ehAdmin}
              className="bg-[#01B8FA] hover:bg-[#3DC8FB] active:bg-[#019BD3] text-[#062B38] font-bold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? 'Salvando…' : mudou ? 'Salvar modo de operação' : 'Modo atual'}
            </button>
            {mudou && (
              <button
                onClick={() => setEscolhido(atual)}
                className="text-sm text-[#8B8D98] hover:text-[#16171D] transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>

          <p className="mt-6 text-xs text-[#A0A2AD] max-w-2xl leading-relaxed">
            Você pode trocar o modo quando quiser — nenhum dado é perdido. Todo o financeiro,
            estoque, clientes e relatórios continuam unificados. No modo <b>Híbrido</b>, as telas
            de varejo e de restaurante ficam disponíveis ao mesmo tempo.
          </p>
        </div>
      </div>
    </div>
  );
}
