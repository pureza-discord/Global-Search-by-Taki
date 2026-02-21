# Global Search

Sistema de busca global avancado para Vencord, inspirado no Discord Mobile.

## Recursos
- Busca por texto, palavras-chave ou frases
- Abas: Mensagens | Midia | Arquivos
- Filtro por autor (inclui "Minhas mensagens")
- Paginacao com cursor
- Clique para ir direto a mensagem
- Modal grande com loading e tratamento de erros

**Desenvolvido por Taki** — discord.gg/pureza  
Utilize com moderacao.

## Como usar este plugin (instalacao completa)

### 1. Como colocar o plugin no Vencord
Clone o repositorio oficial do Vencord (se ainda nao tiver):

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Onde colocar a pasta do plugin
Crie a pasta `src/plugins/GlobalSearch` e coloque o arquivo deste projeto como
`index.tsx` dentro dela.

Estrutura final:

```
Vencord/
└── src/
    └── plugins/
        └── GlobalSearch/
            └── index.tsx
```

### 4. Como buildar

```bash
pnpm build
```

(O build gera o arquivo injetavel em `dist/`.)

### 5. Como injetar

```bash
pnpm inject
```

(Executa o injector para aplicar no Discord instalado.)

### 6. Como ativar no Discord
Abra o Discord → Configuracoes (engrenagem) → Vencord (no menu lateral) →
Plugins → procure por GlobalSearch → ative o switch.

## Dicas extras
- O botao de busca aparece automaticamente na barra de chat (icone de lupa).
- Funciona apenas em DMs e grupos (endpoint oficial do Discord Mobile).
  Mensagens de servidores compartilhados nao sao incluidas para evitar abuso de
  rate limit (conforme especificacao).
- Use com moderacao (o Discord limita buscas).
- Codigo 100% tipado, limpo, sem any desnecessario, sem console injection, sem
  require e compativel com build oficial.

Pronto! Copie, cole, build e aproveite.

GitHub: https://github.com/pureza-discord/Global-Search-by-Taki
Discord: discord.gg/pureza