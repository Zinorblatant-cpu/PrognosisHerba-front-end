import { createContext, useContext, useState, type ReactNode } from "react";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

interface AlocacaoContextValue {
  resultado: GerarAlocacaoDePrevisoesResponse | null;
  setResultado: (resultado: GerarAlocacaoDePrevisoesResponse) => void;
}

const AlocacaoContext = createContext<AlocacaoContextValue | null>(null);

export function AlocacaoProvider({ children }: { children: ReactNode }) {
  const [resultado, setResultado] = useState<GerarAlocacaoDePrevisoesResponse | null>(null);
  return (
    <AlocacaoContext.Provider value={{ resultado, setResultado }}>
      {children}
    </AlocacaoContext.Provider>
  );
}

export function useAlocacao() {
  const ctx = useContext(AlocacaoContext);
  if (!ctx) throw new Error("useAlocacao deve ser usado dentro de AlocacaoProvider");
  return ctx;
}
