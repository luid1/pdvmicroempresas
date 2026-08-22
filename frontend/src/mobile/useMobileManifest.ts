import { useEffect } from 'react';

export function useMobileManifest() {
  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const tema = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const manifestAnterior = manifest?.getAttribute('href');
    const temaAnterior = tema?.getAttribute('content');
    const tituloAnterior = document.title;

    manifest?.setAttribute('href', '/mobile.webmanifest');
    tema?.setAttribute('content', '#0A141D');
    document.title = 'Lumin Acompanhe';

    return () => {
      if (manifestAnterior) manifest?.setAttribute('href', manifestAnterior);
      if (temaAnterior) tema?.setAttribute('content', temaAnterior);
      document.title = tituloAnterior;
    };
  }, []);
}
