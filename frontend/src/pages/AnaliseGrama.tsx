import { useCallback, useRef, useState } from "react";
import { Camera, TriangleAlert, Upload } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { EstadoErro } from "../components/ui/Estado";
import { Button } from "../components/ui/Button";
import { Tag } from "../components/ui/Tag";
import { analisarImagemGrama, ApiError } from "../lib/api";
import type { AnaliseGramaResponse } from "../lib/types";

type Ponto = { x: number; y: number };
type TamanhoNatural = { width: number; height: number };

function formatarPct(valor: number | null): string {
  return valor === null ? "—" : `${valor.toFixed(1)}%`;
}

function Marcador({
  ponto,
  natural,
  className,
}: {
  ponto: Ponto;
  natural: TamanhoNatural;
  className: string;
}) {
  return (
    <span
      className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${className}`}
      style={{ left: `${(ponto.x / natural.width) * 100}%`, top: `${(ponto.y / natural.height) * 100}%` }}
    />
  );
}

export function AnaliseGrama() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AnaliseGramaResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [modoCalibrar, setModoCalibrar] = useState(false);
  const [p1, setP1] = useState<Ponto | null>(null);
  const [p2, setP2] = useState<Ponto | null>(null);
  const [distanciaCm, setDistanciaCm] = useState("");
  const [naturalSize, setNaturalSize] = useState<TamanhoNatural | null>(null);

  const limparCalibracao = useCallback(() => {
    setP1(null);
    setP2(null);
    setDistanciaCm("");
  }, []);

  const escolherArquivo = useCallback(
    (file: File | null) => {
      setResultado(null);
      setErro(null);
      setArquivo(file);
      setPreviewUrl((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior);
        return file ? URL.createObjectURL(file) : null;
      });
      setModoCalibrar(false);
      setNaturalSize(null);
      limparCalibracao();
    },
    [limparCalibracao],
  );

  const aoClicarNaImagem = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!modoCalibrar) return; // deixa propagar: clique fora do modo de calibração reabre o seletor de arquivo
      e.stopPropagation();
      const img = e.currentTarget;
      const rect = img.getBoundingClientRect();
      const ponto: Ponto = {
        x: Math.round(((e.clientX - rect.left) / rect.width) * img.naturalWidth),
        y: Math.round(((e.clientY - rect.top) / rect.height) * img.naturalHeight),
      };
      if (!p1 || (p1 && p2)) {
        setP1(ponto);
        setP2(null);
      } else {
        setP2(ponto);
      }
    },
    [modoCalibrar, p1, p2],
  );

  const analisar = useCallback(async () => {
    if (!arquivo) return;
    setCarregando(true);
    setErro(null);
    try {
      const distancia = Number(distanciaCm);
      const calibracao = p1 && p2 && distancia > 0 ? { p1, p2, distanciaCm: distancia } : undefined;
      const dados = await analisarImagemGrama(arquivo, calibracao);
      setResultado(dados);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao analisar a imagem.");
    } finally {
      setCarregando(false);
    }
  }, [arquivo, p1, p2, distanciaCm]);

  return (
    <div>
      <PageHeader
        title="Análise de grama por imagem"
        subtitle="Envie uma foto e o sistema estima a altura por segmentação de cor (HSV) — sem calibração, o resultado sai em % da altura da imagem."
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
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="Pré-visualização"
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
                }}
                onClick={aoClicarNaImagem}
                className={`max-h-64 rounded-lg object-contain ${modoCalibrar ? "cursor-crosshair" : ""}`}
              />
              {modoCalibrar && naturalSize && (
                <>
                  {p1 && <Marcador ponto={p1} natural={naturalSize} className="bg-primary" />}
                  {p2 && <Marcador ponto={p2} natural={naturalSize} className="bg-warning" />}
                </>
              )}
            </div>
          ) : (
            <>
              <Upload size={28} className="text-fg-faint" />
              <p className="text-sm text-fg-muted">Clique para escolher uma imagem (JPEG ou PNG)</p>
            </>
          )}
        </div>

        {previewUrl && (
          <div className="mt-4 rounded-lg border border-border bg-bg-secondary p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-fg">
              <input
                type="checkbox"
                checked={modoCalibrar}
                onChange={(e) => {
                  setModoCalibrar(e.target.checked);
                  if (!e.target.checked) limparCalibracao();
                }}
              />
              Calibrar com fita métrica (opcional)
            </label>

            {modoCalibrar && (
              <div className="mt-3 space-y-3">
                <p className="text-xs leading-relaxed text-fg-muted">
                  Clique em dois pontos da fita na foto acima cuja distância real você conhece (ex.: a marca de 0cm
                  e a de 10cm).{" "}
                  {!p1 && "Clique no primeiro ponto."}
                  {p1 && !p2 && "Clique no segundo ponto."}
                  {p1 && p2 && "Pontos definidos — informe a distância real abaixo."}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-fg-muted">
                    Distância real entre os pontos
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={distanciaCm}
                      onChange={(e) => setDistanciaCm(e.target.value)}
                      className="w-24 rounded-lg border border-border bg-bg px-2 py-1 text-sm text-fg"
                    />
                    cm
                  </label>
                  {(p1 || distanciaCm) && (
                    <Button variant="secondary" onClick={limparCalibracao}>
                      Limpar pontos
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
        <>
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
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-faint">
                  Por coluna amostrada
                </p>
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
                Sem calibração, a altura acima é uma estimativa relativa (% da altura da imagem), não uma medida em
                centímetros.
              </p>
            </Card>
          </div>

          {resultado.analisePick && (
            <Card className="mt-4">
              <CardHeader
                title="Altura média — fita métrica + Teorema de Pick"
                subtitle="Área da mancha de grama (Área = I + B/2 − 1) ÷ largura, convertida em cm reais"
              />
              <div className="text-center">
                <p className="font-mono-tabular text-3xl font-bold text-primary">
                  {resultado.analisePick.alturaMediaCm.toFixed(1)} cm
                </p>
                <p className="mt-1 text-xs text-fg-faint">altura média estimada</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-fg-faint">Área</p>
                  <p className="font-mono-tabular text-fg">{resultado.analisePick.areaCm2.toFixed(1)} cm²</p>
                </div>
                <div>
                  <p className="text-fg-faint">Largura</p>
                  <p className="font-mono-tabular text-fg">{resultado.analisePick.larguraCm.toFixed(1)} cm</p>
                </div>
                <div>
                  <p className="text-fg-faint">Escala</p>
                  <p className="font-mono-tabular text-fg">{resultado.analisePick.pxPorCm.toFixed(1)} px/cm</p>
                </div>
                <div>
                  <p className="text-fg-faint">Pontos (interior / borda)</p>
                  <p className="font-mono-tabular text-fg">
                    {resultado.analisePick.pontosInteriores} / {resultado.analisePick.pontosBorda}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-fg-faint">
                Essa altura é uma MÉDIA da mancha de grama inteira (área ÷ largura), diferente da leitura por coluna
                acima (que mostra o topo da grama em 3 pontos específicos). Na imagem anotada, os pontos amostrados
                da malha do Teorema de Pick aparecem em{" "}
                <span className="font-medium text-[rgb(0,180,0)]">verde (interior)</span> e{" "}
                <span className="font-medium text-[rgb(255,140,0)]">laranja (borda)</span>, com a caixa em magenta
                marcando a largura usada no cálculo.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
