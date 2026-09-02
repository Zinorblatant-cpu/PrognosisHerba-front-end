import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, TriangleAlert, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { EstadoVazio } from "../components/ui/Estado";
import { Button } from "../components/ui/Button";
import { Tag } from "../components/ui/Tag";
import { gerarAlocacaoDePrevisoes, publicarAlocacao, ApiError } from "../lib/api";
import { useAlocacao } from "../state/AlocacaoContext";

export function Otimizacao() {
  const { resultado, setResultado } = useAlocacao();
  const navigate = useNavigate();

  const [quantidadeEquipes, setQuantidadeEquipes] = useState(4);
  const [capacidadeDiaria, setCapacidadeDiaria] = useState(3);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [publicadoParaPodadores, setPublicadoParaPodadores] = useState(false);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    setPublicadoParaPodadores(false);
    try {
      const resposta = await gerarAlocacaoDePrevisoes({ quantidadeEquipes, capacidadeDiaria });
      setResultado(resposta);

      try {
        await publicarAlocacao({
          periodo: resposta.periodo,
          alocacoes: resposta.alocacoes,
          naoAlocados: resposta.naoAlocados,
        });
        setPublicadoParaPodadores(true);
      } catch {
        // Publicar para o site dos podadores é best-effort: se falhar, o
        // fluxo principal (ver o cronograma aqui) continua funcionando.
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao gerar alocação.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Otimização"
        subtitle="Gera o cronograma completo de poda a partir das previsões da IA, cobrindo todo o horizonte de previsão (modelo horoprognosis / PuLP)"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:sticky lg:top-0 lg:self-start">
          <CardHeader title="Parâmetros" subtitle="Ajuste e rode o solver" />

          <div className="space-y-4">
            <div>
              <label htmlFor="quantidade-equipes" className="mb-1 block text-xs text-fg-muted">
                Quantidade de equipes
              </label>
              <input
                id="quantidade-equipes"
                type="number"
                min={1}
                value={quantidadeEquipes}
                onChange={(e) => setQuantidadeEquipes(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-fg transition-colors hover:border-border-strong focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="capacidade-diaria" className="mb-1 block text-xs text-fg-muted">
                Capacidade diária por equipe
              </label>
              <input
                id="capacidade-diaria"
                type="number"
                min={0.5}
                step={0.5}
                value={capacidadeDiaria}
                onChange={(e) => setCapacidadeDiaria(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-fg transition-colors hover:border-border-strong focus:border-primary focus:outline-none"
              />
            </div>

            <Button onClick={gerar} disabled={carregando} className="w-full">
              {carregando && <Loader2 size={16} className="animate-spin" />}
              Gerar cronograma completo
            </Button>

            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                <p>{erro}</p>
              </div>
            )}
            {publicadoParaPodadores && (
              <p className="text-sm text-primary">✓ Publicado para o site dos podadores.</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Locais derivados da previsão"
            subtitle={
              resultado
                ? `Período: ${resultado.periodo.inicio} a ${resultado.periodo.fim}`
                : "Rode o solver para ver os locais que precisam de poda"
            }
          />

          {!resultado ? (
            <EstadoVazio
              icon={<SlidersHorizontal size={22} />}
              mensagem="Nenhuma alocação gerada ainda."
            />
          ) : (
            <>
              {resultado.alerta && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                  <TriangleAlert size={18} className="mt-0.5 shrink-0" />
                  <p>{resultado.alerta.mensagem}</p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-fg-muted">
                    <th className="pb-2 font-normal">Região</th>
                    <th className="pb-2 font-normal">Prioridade</th>
                    <th className="pb-2 font-normal">Dificuldade</th>
                    <th className="pb-2 font-normal">Data-alvo</th>
                    <th className="pb-2 font-normal">Altura prevista</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.locaisDerivados.map((loc) => (
                    <tr key={loc.id} className="border-t border-border transition-colors hover:bg-white/[0.02]">
                      <td className="py-2 text-fg">{loc.id}</td>
                      <td className="py-2">
                        <Tag nivel={loc.prioridade} />
                      </td>
                      <td className="py-2 text-fg-muted capitalize">{loc.dificuldade}</td>
                      <td className="py-2 text-fg-muted">{loc.dataAlvo}</td>
                      <td className="py-2 text-fg-muted">{loc.alturaPrevistaCm.toFixed(2)} cm</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {resultado.semAlertaNoHorizonte.length > 0 && (
                <p className="mt-4 text-xs text-fg-muted">
                  Sem necessidade de poda no horizonte de previsão: {resultado.semAlertaNoHorizonte.join(", ")}.
                </p>
              )}

              <Button variant="secondary" className="mt-4" onClick={() => navigate("/cronograma")}>
                Ver cronograma gerado →
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
