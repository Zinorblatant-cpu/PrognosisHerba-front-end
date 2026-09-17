import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AlocacaoProvider } from "./state/AlocacaoContext";
import { Home } from "./pages/Home";
import { PrevisoesIA } from "./pages/PrevisoesIA";
import { Otimizacao } from "./pages/Otimizacao";
import { Cronograma } from "./pages/Cronograma";
import { Agrupamento } from "./pages/Agrupamento";
import { Monitoramento } from "./pages/Monitoramento";
import { AnaliseGrama } from "./pages/AnaliseGrama";

export default function App() {
  return (
    <AlocacaoProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/previsoes" element={<PrevisoesIA />} />
            <Route path="/otimizacao" element={<Otimizacao />} />
            <Route path="/cronograma" element={<Cronograma />} />
            <Route path="/agrupamento" element={<Agrupamento />} />
            <Route path="/monitoramento" element={<Monitoramento />} />
            <Route path="/analise-grama" element={<AnaliseGrama />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AlocacaoProvider>
  );
}
