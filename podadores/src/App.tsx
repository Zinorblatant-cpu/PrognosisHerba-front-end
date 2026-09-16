import { useEffect, useMemo, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Agenda } from "./components/Agenda";
import { SeletorEquipe } from "./components/SeletorEquipe";
import { ApiError, concluirLocal, obterAlocacaoAtual } from "./lib/api";
import { limparEquipe, obterEquipeSalva, salvarEquipe } from "./lib/equipe";
import type { AlocacaoPublicada, LocalAlocadoComStatus } from "./lib/types";

export default function App() {
  const [dados, setDados] = useState<AlocacaoPublicada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [equipeId, setEquipeId] = useState<string | null>(() => obterEquipeSalva());
  const [pendente, setPendente] = useState<string | null>(null);

  useEffect(() => {
    obterAlocacaoAtual()
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Erro ao carregar a agenda."))
      .finally(() => setCarregando(false));
  }, []);

  const equipes = useMemo(
    () => Array.from(new Set((dados?.alocacoes ?? []).map((a) => a.equipeId))).sort(),
    [dados],
  );

  function selecionarEquipe(id: string) {
    salvarEquipe(id);
    setEquipeId(id);
  }

  function trocarEquipe() {
    limparEquipe();
    setEquipeId(null);
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3">
        <Loader2 size={18} className="shrink-0 animate-spin text-primary" />
        <p className="text-sm text-fg-muted">Carregando agenda...</p>
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert size={22} className="text-danger" />
        <p className="text-sm text-danger">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-fg-muted">
          Nenhuma alocação foi publicada ainda. Peça para gerar a otimização no painel principal.
        </p>
      </div>
    );
  }

  if (!equipeId || !equipes.includes(equipeId)) {
    return <SeletorEquipe equipes={equipes} onSelecionar={selecionarEquipe} />;
  }

  const equipeAtual = equipeId;

  async function alternarConclusao(dia: string, local: LocalAlocadoComStatus) {
    const chave = `${dia}__${local.localId}`;
    setPendente(chave);
    setErro(null);
    try {
      const atualizado = await concluirLocal({
        equipeId: equipeAtual,
        dia,
        localId: local.localId,
        concluido: !local.concluido,
      });
      setDados(atualizado);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao atualizar o local.");
    } finally {
      setPendente(null);
    }
  }

  return (
    <>
      <Agenda
        dados={dados}
        equipeId={equipeId}
        pendente={pendente}
        onTrocarEquipe={trocarEquipe}
        onAlternarConclusao={alternarConclusao}
      />
      {erro && (
        <p className="fixed inset-x-0 bottom-4 mx-auto w-fit rounded-lg border border-danger/30 bg-bg-card px-4 py-2 text-sm text-danger shadow-lg">
          {erro}
        </p>
      )}
    </>
  );
}
