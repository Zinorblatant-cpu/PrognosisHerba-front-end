import { Link } from "react-router-dom";
import { ArrowRight, Award } from "lucide-react";
import { Button } from "../components/ui/Button";
import fotoArthur from "../assets/equipe/arthur.jpg";
import fotoCarlos from "../assets/equipe/carlos.jpg";
import fotoFelipe from "../assets/equipe/felipe.jpg";
import fotoGuilherme from "../assets/equipe/guilherme.jpg";
import fotoLeonardo from "../assets/equipe/leonardo.jpg";
import fotoLucas from "../assets/equipe/lucas.jpg";
import fotoMateus from "../assets/equipe/mateus.jpg";

type Integrante = {
  nome: string;
  foto: string;
  cargo: string;
  resumo: string;
  destaques?: string[];
  habilidades: string[];
  linkedin: string;
  github?: string;
};

// Resumos escritos a partir do perfil do LinkedIn de cada integrante.
const EQUIPE: Integrante[] = [
  {
    nome: "Arthur Souza",
    foto: fotoArthur,
    cargo: "Estudante de Ciência da Computação · FIAP",
    resumo: "Estudante de Ciência da Computação na FIAP e integrante do time que desenvolve o PrognosisHerba.",
    habilidades: ["Ciência da Computação"],
    linkedin: "https://www.linkedin.com/in/arthur-souza-0b1068354/",
  },
  {
    nome: "Carlos Eduardo Pires Cervelli",
    foto: fotoCarlos,
    cargo: "Desenvolvimento de software · Análise e banco de dados",
    resumo:
      "No 4º semestre de Ciência da Computação na FIAP, com foco em programação, análise de dados e automação de processos. Trabalha com Python, SQL e PostgreSQL e constrói APIs REST, buscando aplicar esse repertório em problemas complexos com soluções eficientes.",
    habilidades: ["Python", "SQL", "PostgreSQL", "Node.js", "Java", "API REST", "IA"],
    linkedin: "https://www.linkedin.com/in/carlos-eduardo-pires-cervelli-7545b53b0/",
  },
  {
    nome: "Felipe Krzyzanovski dos Santos Menezes",
    foto: fotoFelipe,
    cargo: "Tech Intern (Data & AI) · Foursys",
    resumo:
      "Estudante de Ciência da Computação na FIAP, focado em back-end, engenharia de software e IA. Desenvolve em Go, Python, C e C#, cria APIs REST com FastAPI e PostgreSQL e já atuou no setor de tecnologia do Banco Modal, com suporte a times internos e análise de requisitos.",
    destaques: [
      "Databricks Certified: Machine Learning & Data Engineer Associate",
      "Matemática Aplicada à Vida · Prandiano Museu da Matemática",
    ],
    habilidades: ["Go", "Python", "C#", "FastAPI", "PostgreSQL", "Google Cloud", "Machine Learning"],
    linkedin: "https://www.linkedin.com/in/felipe-krzyzanovski-dos-santos-menezes-30760024a/",
    github: "https://github.com/Felipek06",
  },
  {
    nome: "Guilherme Carreri",
    foto: fotoGuilherme,
    cargo: "Estudante de Ciência da Computação · FIAP",
    resumo:
      "Estuda Ciência da Computação na FIAP com foco em Python e Machine Learning, além de fundamentos de SQL e Power BI e integrações avançadas de IA. Quer desenvolver sistemas escaláveis e inteligentes e contribuir com projetos inovadores.",
    habilidades: ["Python", "Machine Learning", "SQL", "Power BI", "IA"],
    linkedin: "https://www.linkedin.com/in/guilherme-carreri-636b7836a/",
  },
  {
    nome: "Leonardo Lopes Oliveira",
    foto: fotoLeonardo,
    cargo: "Estagiário de front-end · Foursys",
    resumo:
      "Estagiário de desenvolvimento front-end na Foursys, onde constrói interfaces modernas e responsivas, e consultor matemático independente. Estudante de Ciência da Computação na FIAP, quer unir desenvolvimento de software e modelos matemáticos em soluções eficientes e com valor prático.",
    destaques: ["Matemática Aplicada à Vida, Blockchain, IA e IE · Prandiano"],
    habilidades: ["Python", "JavaScript", "Java", "SQL", "Front-end", "Modelagem matemática"],
    linkedin: "https://www.linkedin.com/in/leonardo-lopes-oliveira-022567269/",
  },
  {
    nome: "Lucas Ferrari Lima",
    foto: fotoLucas,
    cargo: "Desenvolvimento de software · Análise de dados",
    resumo:
      "No 4º semestre de Ciência da Computação na FIAP, desenvolve programação e análise de dados com Python, SQL e PostgreSQL, além de Java com orientação a objetos e C. Busca aplicar esses conhecimentos em projetos reais.",
    destaques: ["Formações Alura: Python e SQL com PostgreSQL"],
    habilidades: ["Python", "SQL", "PostgreSQL", "Java", "C", "HTML"],
    linkedin: "https://www.linkedin.com/in/lucas-ferrari-lima",
  },
  {
    nome: "Mateus Patricio Pereira",
    foto: fotoMateus,
    cargo: "Analista comercial · Dootax",
    resumo:
      "Analista comercial na Dootax e estudante da FIAP. Proativo e com ótima comunicação, traz para o time experiência em atendimento ao cliente, rotinas administrativas e fluxo financeiro.",
    habilidades: ["Atendimento ao cliente", "Comunicação", "Rotinas administrativas", "Fluxo financeiro"],
    linkedin: "https://www.linkedin.com/in/mateus-patricio-pereira/",
  },
];

// O lucide-react 1.x não traz mais ícones de marca, então os dois logos ficam aqui.
function IconeLinkedin({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconeGithub({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const LINK_PERFIL =
  "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:border-primary/60 hover:bg-primary/5 hover:text-primary";

function CardIntegrante({ integrante }: { integrante: Integrante }) {
  const { nome, foto, cargo, resumo, destaques, habilidades, linkedin, github } = integrante;
  return (
    <article className="group flex w-full flex-col rounded-2xl border border-border bg-bg-card p-5 transition sm:w-[calc(50%-0.625rem)] sm:p-6 xl:w-[calc((100%-2.5rem)/3)] hover:border-primary/40 hover:bg-bg-card-raised hover:shadow-[0_0_0_1px_rgba(166,255,0,0.15),0_16px_32px_-16px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-4">
        <img
          src={foto}
          alt={`Foto de ${nome}`}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-border-strong ring-offset-2 ring-offset-bg-card transition group-hover:ring-primary/60"
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-fg">{nome}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-primary/80">{cargo}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-fg-muted">{resumo}</p>

      {destaques && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {destaques.map((destaque) => (
            <li key={destaque} className="flex items-start gap-2 text-xs leading-relaxed text-fg">
              <Award size={14} className="mt-0.5 shrink-0 text-primary" />
              {destaque}
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`Habilidades de ${nome}`}>
        {habilidades.map((habilidade) => (
          <li
            key={habilidade}
            className="rounded-md border border-border bg-bg-secondary px-2 py-0.5 font-mono text-[11px] text-fg-muted"
          >
            {habilidade}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label={`LinkedIn de ${nome}`} className={LINK_PERFIL}>
          <IconeLinkedin size={14} /> LinkedIn
        </a>
        {github && (
          <a href={github} target="_blank" rel="noopener noreferrer" aria-label={`GitHub de ${nome}`} className={LINK_PERFIL}>
            <IconeGithub size={14} /> GitHub
          </a>
        )}
      </div>
    </article>
  );
}

export function Equipe() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 py-4 sm:gap-14 sm:py-8 lg:py-10">
      <section className="flex flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">PrognosisHerba</p>
        <h1 className="mt-3 max-w-3xl text-balance text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
          Manejo de poda em rodovias, da previsão de crescimento ao cronograma das equipes em campo.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">
          A IA prevê a altura da vegetação por região, um solver de programação linear inteira aloca as equipes
          respeitando prazos e capacidade, e as equipes recebem a agenda no celular.
        </p>
        <Link to="/painel" className="mt-7">
          <Button>
            Acessar o painel <ArrowRight size={16} />
          </Button>
        </Link>
      </section>

      <section aria-labelledby="titulo-apresentacao" className="mx-auto w-full max-w-3xl">
        <h2
          id="titulo-apresentacao"
          className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-fg-faint"
        >
          Apresentação do PrognosisHerba
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-bg-card shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)]">
          <video className="w-full" controls playsInline preload="metadata">
            <source src="/video/apresentacao.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section aria-labelledby="titulo-equipe">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-fg-faint">O time</p>
          <h2 id="titulo-equipe" className="mt-2 text-xl font-bold tracking-tight text-fg sm:text-2xl">
            Quem faz o PrognosisHerba
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            {EQUIPE.length} estudantes da FIAP. Clique no LinkedIn para conhecer cada um.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-5">
          {EQUIPE.map((integrante) => (
            <CardIntegrante key={integrante.nome} integrante={integrante} />
          ))}
        </div>
      </section>
    </div>
  );
}
