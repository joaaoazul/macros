# Macros 🥗

Tracker de macros e nutrição — rápido, bonito e 100% local (os dados nunca saem do teu dispositivo).

## Funcionalidades

- **Onboarding inteligente** — calcula BMR/TDEE com a equação de Mifflin-St Jeor e define alvos de calorias, proteína, hidratos e gordura conforme o objetivo (perder gordura, manter ou ganhar músculo).
- **Diário alimentar** — regista alimentos por refeição (pequeno-almoço, almoço, lanche, jantar, ceia) com navegação entre dias e totais de macros por refeição.
- **Open Food Facts 🇵🇹** — pesquisa em milhares de produtos à venda nos supermercados portugueses (Continente, Pingo Doce, Auchan, Lidl…), incluindo pesquisa por código de barras; a base local (~60 alimentos básicos) funciona offline.
- **Exercício** — regista calorias queimadas, que entram na fórmula do dia (consumido − exercício = líquido / meta).
- **Água** — meta diária (~35 ml/kg, ajustável) com registo rápido de +250/+500 ml.
- **Metas** — meta de calorias, repartição de macros com gráfico donut e edição da percentagem de cada macro.
- **Progresso semanal** — médias, dias no plano e gráfico das calorias dos últimos 7 dias com linha do alvo, tooltip e vista em tabela.
- **Perfil** — peso, TMB, IMC, meta de água, objetivo e nível de atividade; os alvos são recalculados automaticamente.
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
    foods.ts     # base de dados local de alimentos + pesquisa
    off.ts       # cliente Open Food Facts (pt.openfoodfacts.org)
    store.ts     # persistência em localStorage e utilitários de datas
  components/
    Onboarding.tsx    # fluxo inicial em 4 passos
    Diario.tsx        # diário do dia, resumo, água e exercício
    AddFoodSheet.tsx  # pesquisa local + OFF, quantidades, alimentos personalizados
    Metas.tsx         # metas de calorias e repartição de macros (donut)
    Progresso.tsx     # estatísticas e gráfico semanal
    Perfil.tsx        # peso, TMB, IMC, água, objetivo e atividade

```
