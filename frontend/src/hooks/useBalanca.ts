import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Conecta na ponte da balança (balanca_ws.py) via WebSocket.
 * O bridge publica mensagens "peso,estavel" (ex.: "48.750,1") em ws://<host>:8765.
 * O host pode ser ajustado (salvo em localStorage) — útil se o ERP roda numa
 * máquina diferente da balança. Padrão: localhost.
 */
export function getBalancaHost(): string {
  return localStorage.getItem('balanca_host') || 'localhost';
}
export function setBalancaHost(host: string) {
  localStorage.setItem('balanca_host', host.trim() || 'localhost');
}

export interface BalancaState {
  peso: number;
  estavel: boolean;
  conectado: boolean;
  host: string;
}

export function useBalanca(ativo: boolean) {
  const [peso, setPeso] = useState(0);
  const [estavel, setEstavel] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [host, setHostState] = useState(getBalancaHost());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trocarHost = useCallback((novo: string) => {
    setBalancaHost(novo);
    setHostState(getBalancaHost());
  }, []);

  useEffect(() => {
    if (!ativo) return;
    let fechado = false;

    const conectar = () => {
      if (fechado) return;
      try {
        const ws = new WebSocket(`ws://${host}:8765`);
        wsRef.current = ws;
        ws.onopen = () => setConectado(true);
        ws.onclose = () => {
          setConectado(false);
          if (!fechado) reconnectRef.current = setTimeout(conectar, 1500);
        };
        ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
        ws.onmessage = (ev) => {
          const [p, s] = String(ev.data).split(',');
          const val = parseFloat(p);
          if (!Number.isNaN(val)) {
            setPeso(val);
            setEstavel(s === '1');
          }
        };
      } catch {
        if (!fechado) reconnectRef.current = setTimeout(conectar, 1500);
      }
    };
    conectar();

    return () => {
      fechado = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      try { wsRef.current?.close(); } catch { /* noop */ }
      setConectado(false);
    };
  }, [ativo, host]);

  return { peso, estavel, conectado, host, trocarHost } as BalancaState & { trocarHost: (h: string) => void };
}
