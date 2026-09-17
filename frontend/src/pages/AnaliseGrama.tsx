import { useCallback, useRef, useState } from "react";
import { Camera, TriangleAlert, Upload } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { EstadoErro } from "../components/ui/Estado";
import { Button } from "../components/ui/Button";
import { Tag } from "../components/ui/Tag";
import { analisarImagemGrama, ApiError } from "../lib/api";
import type { AnaliseGramaResponse } from "../lib/types";

function formatarPct(valor: number | null): string {
  return valor === null ? "—" : `${valor.toFixed(1)}%`;
}

export function AnaliseGrama() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AnaliseGramaResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolherArquivo = useCallback((file: File | null) => {
    setResultado(null);
    setErro(null);
    setArquivo(file);
    setPreviewUrl((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const analisar = useCallback(async () => {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const dados = await analisarImagemGrama(arquivo);
      setResultado(dados);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao analisar a imagem.");
    } finally {
      setCarregando(false);
    }
  }, [arquivo]);

  return (
    <div>
      <PageHeader
        title="Análise de grama por imagem"
        subtitle="Envie uma foto e o sistema estima a altura por segmentação de cor (HSV) — sem câmera fixa calibrada, o resultado sai em % da altura da imagem."
      />

      <Card className="mb-4">
        <CardHeader title="1. Escolher imagem" />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-bg-secondary px-4 py-8 text-center transition hover:border-primary/50"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Pré-visualização" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <>
              <Upload size={28} className="text-fg-faint" />
              <p className="text-sm text-fg-muted">Clique para escolher uma imagem (JPEG ou PNG)</p>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={analisar} disabled={!arquivo || carregando}>
            <Camera size={16} />
            {carregando ? "Analisando..." : "Analisar imagem"}
          </Button>
          {arquivo && (
            <Button variant="secondary" onClick={() => escolherArquivo(null)} disabled={carregando}>
              Limpar
            </Button>
          )}
        </div>
      </Card>

      {erro && <EstadoErro mensagem={erro} className="mb-4" />}

      {resultado && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Imagem anotada" subtitle="Máscara verde, colunas amostradas e categoria detectada" />
            <img
              src={resultado.imagemAnotadaBase64}
              alt="Imagem anotada com a máscara de grama"
              className="w-full rounded-lg border border-border"
            />
          </Card>

          <Card>
            <CardHeader
              title="Resultado"
              action={<Tag nivel={resultado.categoria.toLowerCase()} label={resultado.categoria} />}
            />

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-fg-faint">Altura mediana</p>
                <p className="font-mono-tabular text-base text-fg">{formatarPct(resultado.alturaMedianaPct)}</p>
              </div>
              <div>
                <p className="text-fg-faint">Margem de erro</p>
                <p className="font-mono-tabular text-base text-fg">{formatarPct(resultado.margemErroPct)}</p>
              </div>
              <div>
                <p className="text-fg-faint">Cobertura verde</p>
                <p className="font-mono-tabular text-base text-fg">{formatarPct(resultado.coberturaVerdePct)}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-faint">Por coluna amostrada</p>
              <ul className="space-y-1.5">
                {resultado.porColuna.map((coluna) => (
                  <li
                    key={coluna.fracaoX}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-sm"
                  >
                    <span className="text-fg-muted">{Math.round(coluna.fracaoX * 100)}% da largura</span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono-tabular text-fg">{formatarPct(coluna.alturaPct)}</span>
                      <Tag nivel={coluna.categoria.toLowerCase()} label={coluna.categoria} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg-faint">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              Sem calibração de câmera fixa, a altura é uma estimativa relativa (% da altura da imagem), não uma
              medida em centímetros.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
