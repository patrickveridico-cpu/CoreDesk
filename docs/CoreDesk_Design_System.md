# CoreDesk — Design system

## Conceito

CoreDesk é o núcleo operacional: menos janelas, mais contexto e foco na execução.

## Visual

- Canvas: grafite quase preto (`#0b0e12`).
- Painéis: grafite elevado (`#11161c`, `#171d25`).
- Linhas discretas (`#252d37`).
- Acento: ciano/azul elétrico (`#1cc8ee`).
- Texto principal branco; texto secundário em cinza azulado.
- Ícones lineares Lucide React.

## Layout

- Titlebar: 40 px.
- Sidebar: 56 px.
- Navegação web ou identidade WhatsApp: 38 px.
- O conteúdo usa o restante da altura disponível.
- Evitar cabeçalhos grandes, gradientes, sombras pesadas e cartões sem função.

## Marca

O original está em `assets/brand/CoreDesk-logo-conceito.png`. A composição completa serve para splash, Home, Comunicação, Sobre e documentação. O símbolo derivado serve para titlebar, avatares e ícones pequenos. Nenhuma versão altera cores ou proporções.

## Home

A Home usa a marca com bastante espaço negativo, greeting contextual e uma única frase rotativa. A transição é curta, sem deslocamento exagerado, e respeita `prefers-reduced-motion`.

## Movimento e acessibilidade

Loading usa indicadores pequenos e estados sempre acompanhados por texto ou tooltip. Animações devem ser reduzidas ou removidas para usuários que preferem menos movimento.
