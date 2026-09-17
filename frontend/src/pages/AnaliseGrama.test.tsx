import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnaliseGrama } from "./AnaliseGrama";
import { analisarImagemGrama, ApiError } from "../lib/api";
import type { AnaliseGramaResponse } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, analisarImagemGrama: vi.fn() };
});

const RESULTADO_BASE: AnaliseGramaResponse = {
  nivel: 3,
  categoria: "ALTA",
  alturaMedianaPct: 39.5,
  margemErroPct: 0,
  coberturaVerdePct: 40,
  porColuna: [
    { fracaoX: 0.25, alturaPct: 39.5, nivel: 3, categoria: "ALTA" },
    { fracaoX: 0.5, alturaPct: 39.5, nivel: 3, categoria: "ALTA" },
    { fracaoX: 0.75, alturaPct: 39.5, nivel: 3, categoria: "ALTA" },
  ],
  larguraPx: 300,
  alturaPx: 200,
  imagemAnotadaBase64: "data:image/png;base64,AAAA",
  analisePick: null,
};

function arquivoDeGrama() {
  return new File(["conteudo"], "grama.png", { type: "image/png" });
}

async function escolherEExibirPreview(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, arquivoDeGrama());
  return screen.getByAltText("Pré-visualização") as HTMLImageElement;
}

/** Configura a imagem de preview com dimensão nativa 400x300 renderizada em 200x150,
 * e dispara o evento `load` (jsdom não decodifica imagens de verdade). */
function configurarImagemEDispararLoad(img: HTMLImageElement) {
  Object.defineProperty(img, "naturalWidth", { value: 400, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: 300, configurable: true });
  img.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 150, right: 200, bottom: 150, x: 0, y: 0, toJSON() {} }) as DOMRect;
  fireEvent.load(img);
}

describe("AnaliseGrama", () => {
  beforeEach(() => {
    vi.mocked(analisarImagemGrama).mockReset();
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  it("permite escolher uma imagem e analisar sem calibração", async () => {
    vi.mocked(analisarImagemGrama).mockResolvedValue(RESULTADO_BASE);
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    await escolherEExibirPreview(user);
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    expect(analisarImagemGrama).toHaveBeenCalledWith(expect.any(File), undefined);
    expect(await screen.findByRole("heading", { name: "Resultado" })).toBeInTheDocument();
    expect(screen.queryByText(/Altura média — fita métrica/)).not.toBeInTheDocument();
  });

  it("mostra mensagem de erro vinda de ApiError", async () => {
    vi.mocked(analisarImagemGrama).mockRejectedValue(new ApiError("Backend fora do ar.", 0));
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    await escolherEExibirPreview(user);
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    expect(await screen.findByText("Backend fora do ar.")).toBeInTheDocument();
  });

  it("envia os pontos clicados e a distância como calibração ao analisar", async () => {
    vi.mocked(analisarImagemGrama).mockResolvedValue(RESULTADO_BASE);
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    const img = await escolherEExibirPreview(user);
    configurarImagemEDispararLoad(img);

    await user.click(screen.getByLabelText(/Calibrar com fita métrica/));

    // Renderizado em 200x150, nativo 400x300 -> fator de escala 2x em cada eixo.
    fireEvent.click(img, { clientX: 100, clientY: 50 }); // -> ponto nativo (200,100)
    fireEvent.click(img, { clientX: 150, clientY: 100 }); // -> ponto nativo (300,200)

    await user.type(screen.getByLabelText(/Distância real entre os pontos/), "10");
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    expect(analisarImagemGrama).toHaveBeenCalledWith(expect.any(File), {
      p1: { x: 200, y: 100 },
      p2: { x: 300, y: 200 },
      distanciaCm: 10,
    });
  });

  it("um terceiro clique reinicia a calibração no novo ponto", async () => {
    vi.mocked(analisarImagemGrama).mockResolvedValue(RESULTADO_BASE);
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    const img = await escolherEExibirPreview(user);
    configurarImagemEDispararLoad(img);
    await user.click(screen.getByLabelText(/Calibrar com fita métrica/));

    fireEvent.click(img, { clientX: 100, clientY: 50 });
    fireEvent.click(img, { clientX: 150, clientY: 100 });
    fireEvent.click(img, { clientX: 50, clientY: 25 }); // 3º clique -> reinicia em p1, limpa p2

    await user.type(screen.getByLabelText(/Distância real entre os pontos/), "10");
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    // Sem p2 definido, a calibração não é enviada.
    expect(analisarImagemGrama).toHaveBeenCalledWith(expect.any(File), undefined);
  });

  it("mostra o card de altura calibrada quando a resposta traz analisePick", async () => {
    vi.mocked(analisarImagemGrama).mockResolvedValue({
      ...RESULTADO_BASE,
      analisePick: {
        pxPorCm: 10,
        pontosInteriores: 36704,
        pontosBorda: 796,
        areaCm2: 371.01,
        larguraCm: 25,
        alturaMediaCm: 14.8404,
      },
    });
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    await escolherEExibirPreview(user);
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    expect(await screen.findByText(/Altura média — fita métrica/)).toBeInTheDocument();
    expect(screen.getByText("14.8 cm")).toBeInTheDocument();
  });

  it("não mostra o card de altura calibrada quando analisePick é null", async () => {
    vi.mocked(analisarImagemGrama).mockResolvedValue(RESULTADO_BASE);
    const user = userEvent.setup();
    render(<AnaliseGrama />);

    await escolherEExibirPreview(user);
    await user.click(screen.getByRole("button", { name: /Analisar imagem/ }));

    await screen.findByRole("heading", { name: "Resultado" });
    expect(screen.queryByText(/Altura média — fita métrica/)).not.toBeInTheDocument();
  });
});
