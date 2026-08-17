import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { podeAcao, AcaoTela } from '../config/telas';
import { authApi } from '../services/api';

interface Filial { id: string; codigo: string; nome: string }
type Preferencias = Record<string, unknown>;
interface AuthUser { id: string; nome: string; email: string; role: string; tenantId: string; telas?: string[]; telaInicial?: string | null; acoes?: Record<string, string[]>; preferencias?: Preferencias }

interface AuthCtx {
  user: AuthUser | null;
  filiais: Filial[];
  filialAtiva: Filial | null;
  setFilialAtiva: (f: Filial) => void;
  refreshFiliais: () => Promise<Filial[]>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  pode: (rota: string, acao: AcaoTela) => boolean;
  preferencias: Preferencias;
  savePreferencias: (patch: Preferencias) => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [filialAtiva, setFilialAtivaState] = useState<Filial | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshFiliais = useCallback(async () => {
    if (!localStorage.getItem('wms_token')) return [];
    const { data } = await authApi.filiais();
    const atualizadas: Filial[] = (data || []).filter((f: any) => f.ativo !== false);
    setFiliais(atualizadas);
    localStorage.setItem('wms_filiais', JSON.stringify(atualizadas));
    setFilialAtivaState((atual) => {
      const preservada = atualizadas.find((f) => f.id === atual?.id) || atualizadas[0] || null;
      if (preservada) localStorage.setItem('wms_filial', JSON.stringify(preservada));
      else localStorage.removeItem('wms_filial');
      return preservada;
    });
    return atualizadas;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('wms_user');
    const storedFilial = localStorage.getItem('wms_filial');
    const storedFiliais = localStorage.getItem('wms_filiais');
    if (stored) setUser(JSON.parse(stored));
    if (storedFiliais) setFiliais(JSON.parse(storedFiliais));
    if (storedFilial) setFilialAtivaState(JSON.parse(storedFilial));
    setIsLoading(false);
    if (stored && localStorage.getItem('wms_token')) void refreshFiliais().catch(() => { /* mantem cache offline */ });
  }, [refreshFiliais]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const texto = await res.text();
    let data: any = null;
    if (texto) { try { data = JSON.parse(texto); } catch { data = null; } }
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || 'Não foi possível entrar. Tente de novo em instantes.');
    }
    if (!data) throw new Error('O servidor demorou a responder direito. Tente de novo em instantes.');

    const authUser: AuthUser = { ...data.usuario, tenantId: data.tenant.id };
    const userFiliais: Filial[] = data.usuario.filiais || [];
    const primeiraFilial = userFiliais[0] || null;

    localStorage.setItem('wms_token', data.token);
    localStorage.setItem('wms_user', JSON.stringify(authUser));
    localStorage.setItem('wms_filiais', JSON.stringify(userFiliais));
    if (primeiraFilial) localStorage.setItem('wms_filial', JSON.stringify(primeiraFilial));

    setUser(authUser);
    setFiliais(userFiliais);
    setFilialAtivaState(primeiraFilial);
  };

  const logout = () => {
    ['wms_token', 'wms_user', 'wms_filial', 'wms_filiais'].forEach((k) => localStorage.removeItem(k));
    setUser(null);
    setFiliais([]);
    setFilialAtivaState(null);
  };

  const setFilialAtiva = (f: Filial) => {
    setFilialAtivaState(f);
    localStorage.setItem('wms_filial', JSON.stringify(f));
  };

  // Pode executar uma ação (CRIAR/EDITAR/EXCLUIR) na rota informada?
  const pode = (rota: string, acao: AcaoTela) => podeAcao(user?.role, user?.acoes, rota, acao);

  const preferencias: Preferencias = user?.preferencias || {};

  // Salva preferências que seguem a conta: atualiza o estado/localStorage na hora
  // (UI responsiva) e persiste no backend em segundo plano (best-effort).
  const savePreferencias = (patch: Preferencias) => {
    setUser((atual) => {
      if (!atual) return atual;
      const merged = { ...(atual.preferencias || {}), ...patch };
      const novo = { ...atual, preferencias: merged };
      localStorage.setItem('wms_user', JSON.stringify(novo));
      return novo;
    });
    // Persiste no perfil do usuário; se falhar (offline), a versão local já valeu.
    authApi.salvarPreferencias(patch).catch(() => { /* best-effort: mantém local */ });
  };

  return (
    <Ctx.Provider value={{ user, filiais, filialAtiva, setFilialAtiva, refreshFiliais, login, logout, isLoading, pode, preferencias, savePreferencias }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
