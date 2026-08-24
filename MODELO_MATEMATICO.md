# Horoprognosis — Modelo Matemático (gerenciador de poda)

## O que é este modelo?

Variante da família **Horótimo** (mesmo motor de otimização do CronoManeger
e da Atos: **Programação Linear Inteira Binária** com
[PuLP](https://coin-or.github.io/pulp/)), aplicada a um domínio diferente:
alocar **equipes de poda** a **locais de poda** dentro de um período de um
mês, respeitando dias úteis e a capacidade diária de cada equipe.

Diferença central em relação ao CronoManeger/Atos: lá, "matéria" é
**recorrente** (precisa de N aulas por semana, toda semana). Aqui, cada
**local de poda é uma tarefa única** — é podado no máximo uma vez dentro do
mês, não repete. Os locais não são cadastrados manualmente: chegam prontos
de um sistema/IA externo, cada um já com **prioridade** e **dificuldade**
definidas.

---

## Conjuntos

| Conjunto | Significado | Origem |
|---|---|---|
| `A` | Locais de poda | Entrada dinâmica (lista vinda da IA externa a cada rodada) |
| `C` | Equipes de poda | Cadastro fixo do sistema (equipe_1 … equipe_k) |
| `D` | Dias úteis do mês corrente | Calculado do calendário real (segunda–sexta; tipicamente 20–23 dias/mês) |

Cada local `a ∈ A` chega com dois atributos fixos, que **não são índices**
de `H` (ver nota de design abaixo):

- `prioridade(a)` ∈ {baixa, média, alta}
- `dificuldade(a)` ∈ {fácil, média, difícil}

---

## Variável Horótima

`H[a, c, d]` é binária (0 ou 1) e representa:

- `1` → o local `a` é podado pela equipe `c`, no dia `d`
- `0` → não é podado nesse dia por essa equipe

### Nota de design: por que H tem 3 índices, não 4

O pedido original listava quatro dimensões: local (`a`), prioridade (`b`),
equipe (`c`) e dia (`d`), com dificuldade como um quinto fator. Mas
prioridade e dificuldade **não são escolhas do solver** — são dados fixos
que já chegam junto com cada local. Modelá-las como índices de `H`
permitiria combinações sem sentido, como o mesmo local `a` aparecer também
sob uma prioridade errada. Por isso ambas viram **parâmetros de `a`**,
`prioridade(a)` e `dificuldade(a)`, e `H` fica com três índices:
`H[a, c, d]`. A prioridade entra na função objetivo como peso (abaixo); a
dificuldade entra na restrição de capacidade diária (R2).

> **Peço confirmação deste ponto** — se a intenção era mesmo permitir que o
> solver "escolhesse" prioridade ou dificuldade para um local (o que não
> faz sentido no mundo real, já que ambas vêm prontas da IA), me avise e eu
> reformulo.

---

## Parâmetros

| Parâmetro | Significado | Valores (placeholder) |
|---|---|---|
| `p(a)` | Peso da prioridade do local `a` | baixa = 1, média = 2, alta = 3 |
| `custo(a)` | Custo de capacidade da dificuldade do local `a` | fácil = 1, média = 1,5, difícil = 3 |
| `CAP` | Capacidade diária de cada equipe (em "unidades de poda fácil equivalentes") | 3 |

O valor de `CAP = 3` com esses custos reproduz exatamente os números que
você deu: `3 × fácil = 3` (3 podas fáceis/dia), `2 × média = 3` (2 podas
médias/dia), `1 × difícil = 3` (1 poda difícil/dia).

---

## Função Objetivo

Maximizar a soma das variáveis Horótimas, ponderada pela prioridade de
cada local:

```
FO = Σ p(a) × H[a, c, d]   para todo (a, c, d)
```

Como o peso de prioridade alta é maior, quando a capacidade do mês não é
suficiente para podar todos os locais, o solver tende a preencher a agenda
com os locais mais urgentes primeiro.

---

## Restrições

### R1 — Cada local podado no máximo uma vez no mês

```
Σ (c,d) H[a, c, d] ≤ 1     para todo a ∈ A
```

> **Confirmado**: um local nunca é podado duas vezes dentro do mesmo mês.
> A regra de "só volta depois de 3 meses" é responsabilidade do sistema
> externo que gera `A` — a IA só reenvia um local se já passou o prazo de
> 3 meses desde o último corte. Ou seja, o `A` que o horoprognosis recebe
> a cada rodada já vem sem locais recém-cortados; o modelo em si não
> precisa guardar esse histórico de 3 meses, só precisa impedir repetição
> **dentro do mês corrente**, que é exatamente o que R1 garante.
>
> **Confirmado**: fica `≤ 1`, não `= 1`. Se a capacidade do mês não bastar
> para todos os locais de `A`, o modelo continua **viável** — não estoura
> erro, só deixa de fora os locais de menor prioridade. Em vez de falhar
> silenciosamente, esse cenário aciona o **Alerta de capacidade
> insuficiente** (nova seção abaixo), que recomenda aumentar o número de
> equipes.

### R2 — Capacidade diária por equipe, ponderada pela dificuldade

```
Σ a custo(a) × H[a, c, d] ≤ CAP     para todo c ∈ C, d ∈ D
```

> **Confirmado**: pode misturar dificuldades diferentes no mesmo dia para
> a mesma equipe, desde que a soma dos custos não passe de 3 — por
> exemplo, 1 local fácil (custo 1) + 1 local médio (custo 1,5) = 2,5 ≤ 3,
> permitido.

---

## Alerta de capacidade insuficiente

Quando a demanda do lote de locais recebido da IA é maior do que a
capacidade que as equipes têm no mês, o sistema não deve só deixar
locais de fora silenciosamente — ele avisa, sugerindo aumentar equipes.

### Capacidade total do mês

```
capacidadeTotalMes = |C| × |D| × CAP
```

### Demanda total do lote

```
demandaTotal = Σ (a ∈ A) custo(a)
```

### Regra do alerta

```
Se demandaTotal > capacidadeTotalMes:
    déficit = demandaTotal − capacidadeTotalMes
    equipesDiaAdicionais = ⌈ déficit / CAP ⌉
    equipesExtrasSugeridas = ⌈ equipesDiaAdicionais / |D| ⌉
```

Quando isso acontece, a resposta do sistema inclui, junto com a grade
gerada:

- a mensagem de alerta ("capacidade insuficiente para cobrir todos os
  locais deste mês; considere aumentar em ~N equipes"), com o número de
  `equipesExtrasSugeridas` já calculado;
- a lista dos locais que ficaram sem poda (`Σ (c,d) H[a,c,d] = 0` depois
  de resolvido) — tendem a ser os de menor prioridade, já que a função
  objetivo prioriza os mais urgentes primeiro quando falta capacidade.

Esse alerta **não é uma restrição do PuLP** (não teria por que virar uma
constraint no solver) — é uma checagem em cima dos dados de entrada
(antes de resolver, pra saber de antemão se vai faltar capacidade) e do
resultado (depois de resolver, pra saber exatamente quem ficou de fora),
calculada e devolvida junto da grade pela futura API.

**Exemplo**: 4 equipes × 21 dias úteis × 3 pontos = 252 pontos de
capacidade no mês. Se o lote de locais somar 300 pontos de demanda,
faltam 48 pontos → `⌈48/3⌉` = 16 equipes-dia adicionais → `⌈16/21⌉` = 1
equipe extra já resolveria (rodando o mês inteiro), ou distribuir esses
16 equipes-dia entre reforços pontuais.

---

### R3 — Dias úteis

Já embutido na própria definição do conjunto `D` (só contém segunda a
sexta-feira do mês) — não precisa de restrição extra no modelo.

### Extensão futura (não implementada agora)

Disponibilidade de equipe por dia (equipe de folga, feriado local, etc.),
equivalente ao R5 do modelo original (lá, disponibilidade de professor).
Não foi pedida agora — só registro aqui como possibilidade natural para uma
próxima rodada, caso surja a necessidade.

---

## Variante: cronograma completo (sem mês fixo)

A versão acima resolve um mês por vez — o que fica de fora vira "fora do
mês". A Otimização do frontend não pede mais um mês: gera um cronograma
único cobrindo todo o horizonte de 12 semanas de previsão de uma vez
(`rodar_modelo_horoprognosis_com_prazos` em `horoprognosis.py`, usada por
`POST /previsoes/gerar-alocacao`). Duas mudanças em cima do modelo base:

### `D` deixa de ser um mês fixo

`D` passa a ser os dias úteis entre o prazo mais próximo e o mais
distante entre os locais do lote (`gerar_dias_uteis_intervalo`) — o
suficiente para caber qualquer alocação válida, sem sobra desnecessária.

### R3-completo — Cada local só pode ser podado até o seu próprio prazo

Cada local `a` tem um prazo próprio, `prazo(a)` — a primeira semana em que
a previsão da IA indica que a vegetação atinge o limiar de poda (vem de
`previsoes.py: derivar_locais_de_poda`). Diferente do modelo de mês fixo
(onde `D` já garantia isso implicitamente, por só conter dias daquele
mês), aqui isso vira uma restrição explícita:

```
H[a, c, d] = 0     para todo d ∈ D tal que d > prazo(a)
```

Implementada sem precisar de uma constraint extra no solver: os dias
depois do prazo de cada local simplesmente não viram variável de decisão
(ver `rodar_modelo_horoprognosis_com_prazos`) — mais leve que criar a
variável e depois forçá-la a zero.

### R4 — Balanceamento de carga entre equipes

Problema observado na prática: como as equipes são intercambiáveis (não
têm custo nem habilidade diferentes entre si), a Função Objetivo sozinha
é indiferente entre concentrar tudo numa equipe só ou espalhar por
todas — ambas valem exatamente o mesmo em prioridade coberta. Resultado:
com 4 equipes configuradas, o solver podia deixar 2 completamente
ociosas mesmo sobrando capacidade, só porque nada no modelo preferia uma
distribuição mais justa.

Correção (`aplicar_balanceamento_de_carga`): duas variáveis contínuas,
`carga_maxima` e `carga_minima` — o maior e o menor custo total que
qualquer equipe carrega, somado em todos os dias do período:

```
carga_minima ≤ Σ (a,d) custo(a) × H[a, c, d] ≤ carga_maxima     para todo c ∈ C
```

E a Função Objetivo ganha dois termos secundários:

```
FO_completa = Σ p(a) × H[a, c, d] − εmax × carga_maxima + εmin × carga_minima
```

`εmax` achata o topo (menos carga na equipe mais sobrecarregada);
`εmin ≪ εmax` levanta o piso só como desempate — sem ele, minimizar
apenas o topo pode empatar entre "espalhar por todas" e "concentrar em
algumas e deixar outras zeradas", já que as duas soluções têm a mesma
carga máxima. Os dois épsilons são calculados a partir da demanda total
do lote para nunca somarem mais que 1 ponto de prioridade — ou seja,
nunca mudam **quais** locais entram no cronograma (isso continua 100%
decidido por R1/R2/R3-completo/FO original); só desempatam, entre
soluções de mesma prioridade total, a favor da que distribui melhor a
carga entre as equipes.

---

## Tamanho do problema

```
Variáveis binárias = |A| × |C| × |D|
```

Exemplo ilustrativo: 50 locais × 4 equipes × 21 dias úteis = **4.200**
variáveis binárias.

---

## Pontos confirmados (modelo fechado)

- `H[a, c, d]` com 3 índices (local, equipe, dia) — prioridade e
  dificuldade ficam como parâmetros de `a`, não como índices.
- R1 fica `≤ 1` (não obriga podar todo mundo no mês) + alerta de
  capacidade quando faltar equipe.
- R2 permite misturar dificuldades diferentes no mesmo dia, respeitando
  o orçamento de 3 pontos por equipe/dia.
- Local nunca repete dentro do mesmo mês; o intervalo de 3 meses é
  controlado pela IA externa antes de montar o lote `A`.
- Pesos de prioridade (1/2/3) e custos de dificuldade (1/1,5/3) ficam
  como placeholders — ajustáveis depois, sem mudar a estrutura do modelo.
- A variante de cronograma completo (sem mês fixo, ver seção acima)
  acrescenta R3-completo (prazo por local) e R4 (balanceamento entre
  equipes) por cima do modelo base, sem alterar R1/R2/FO original.

Modelo matemático fechado. Próximo passo natural: implementar o solver
em PuLP (espelhando `backend/cronomaneger_atos.py`) + uma API FastAPI
para receber a lista de locais da IA e devolver a alocação (grade +
alerta de capacidade), com os mesmos testes automatizados (pytest) que o
resto do projeto usa.
