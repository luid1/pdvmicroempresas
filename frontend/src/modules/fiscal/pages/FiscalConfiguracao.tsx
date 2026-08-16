import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, FileKey, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../../../services/api';

export default function FiscalConfiguracao() {
  const [config, setConfig] = useState<any>(null);
  const [erro, setErro] = useState('');
  const carregar = () => { setErro(''); api.get('/nfe/configuracao/status').then(r => setConfig(r.data)).catch(e => setErro(e.response?.data?.message || 'Falha ao consultar o ambiente fiscal.')); };
  useEffect(carregar, []);
  const ok = !!config?.prontoParaTransmitir;
  return <div className="min-h-full bg-[#F7F7F8] p-5"><div className="mx-auto max-w-5xl space-y-4">
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold text-[#202123]">Central SEFAZ</h1><p className="mt-1 text-xs text-slate-500">Ambiente, credenciais e requisitos de emissão de NF-e/NFC-e.</p></div><button onClick={carregar} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
    {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>}
    {config && <>
      <div className={`rounded-2xl border p-5 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-start gap-3">{ok ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <AlertTriangle className="h-6 w-6 text-amber-600" />}<div><h2 className="font-semibold text-[#202123]">{ok ? 'Integração pronta para homologação/transmissão' : 'Transmissão real bloqueada com segurança'}</h2><p className="mt-1 text-xs text-slate-600">{config.aviso}</p></div></div></div>
      <div className="grid md:grid-cols-3 gap-3">{[[Cloud, 'Provedor', config.provider], [ShieldCheck, 'Ambiente', config.ambiente], [FileKey, 'Credencial', config.tokenConfigurado ? 'Configurada' : 'Pendente']].map(([Icon, l, v]: any) => <div key={l} className="rounded-xl border border-slate-200 bg-white p-4"><Icon className="h-5 w-5 text-[#0F8A72]" /><p className="mt-3 text-[10px] uppercase tracking-wide text-slate-400">{l}</p><p className="mt-1 text-sm font-semibold capitalize text-[#202123]">{String(v)}</p></div>)}</div>
    </>}
    <div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-[#202123]">Checklist antes de produção</h2><div className="mt-4 grid md:grid-cols-2 gap-2">{[
      'Credenciamento NF-e/NFC-e na SEFAZ de cada UF', 'Certificado digital A1 válido cadastrado no provedor',
      'CSC e ID do CSC para NFC-e', 'CNPJ, IE, CRT, endereço e código IBGE da filial',
      'NCM, CEST, CFOP, CST/CSOSN e GTIN dos produtos', 'CST IBS/CBS e cClassTrib conforme regras vigentes',
      'Série e numeração autorizadas', 'Cenários aprovados no ambiente de homologação',
    ].map(x => <div key={x} className="flex gap-2 rounded-lg bg-[#F7F7F8] px-3 py-2 text-xs text-slate-600"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-slate-300 bg-white" />{x}</div>)}</div></div>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800"><b>Proteção operacional:</b> homologação e produção são separadas. Se o ambiente e a URL não coincidirem, o backend bloqueia a emissão. Reenvios usam a mesma referência interna para evitar duplicidade.</div>
  </div></div>;
}
