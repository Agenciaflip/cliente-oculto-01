import { useMemo } from "react";

export type SubdomainType = 'admin' | 'app' | 'root';

export const useSubdomainDetection = (): SubdomainType => {
  const subdomain = useMemo(() => {
    const hostname = window.location.hostname;
    
    // Ambiente de desenvolvimento (localhost)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'root';
    }
    
    // Detecta subdomínio admin
    if (hostname.startsWith('admin.')) {
      return 'admin';
    }
    
    // Detecta subdomínio app
    if (hostname.startsWith('app.')) {
      return 'app';
    }
    
    // Domínio raiz (landing page)
    return 'root';
  }, []);

  return subdomain;
};
