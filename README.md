# Macros 🥗

Tracker de macros e nutrição — rápido, bonito e 100% local (os dados nunca saem do teu dispositivo).

## Funcionalidades

- **Onboarding inteligente** — calcula BMR/TDEE com a equação de Mifflin-St Jeor e define alvos de calorias, proteína, hidratos e gordura conforme o objetivo (perder gordura, manter ou ganhar músculo).
- **Diário alimentar** — regista alimentos por refeição (pequeno-almoço, almoço, lanche, jantar) com navegação entre dias.
- **Resumo do dia** — anel de calorias restantes e barras de progresso por macro.
- **Base de dados de alimentos** — ~60 alimentos comuns em Portugal (valores por 100 g/ml), com pesquisa sem acentos e alimentos personalizados.
- **Progresso semanal** — médias, dias no plano e gráfico das calorias dos últimos 7 dias com linha do alvo, tooltip e vista em tabela.
- **Perfil** — atualiza peso, objetivo e nível de atividade; os alvos são recalculados automaticamente.
- **Tema claro e escuro** — segue a preferência do sistema.
- **Persistência local** — tudo guardado em `localStorage`, sem contas nem servidores.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4

## Desenvolvimento

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # typecheck + build de produção
npm run preview   # servir a build
```

## Estrutura

```
src/
  lib/
    calc.ts      # BMR/TDEE, alvos de macros, somas do diário
    foods.ts     # base de dados de alimentos + pesquisa
    store.ts     # persistência em localStorage e utilitários de datas
  components/
    Onboarding.tsx    # fluxo inicial em 4 passos
    Diario.tsx        # diário do dia + resumo
    AddFoodSheet.tsx  # pesquisa/quantidade/alimentos personalizados
    Progresso.tsx     # estatísticas e gráfico semanal
    Perfil.tsx        # edição do perfil e alvos
    MacroRing.tsx     # anel de progresso em SVG
```
