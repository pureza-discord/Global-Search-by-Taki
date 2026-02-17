# GlobalSearchPro

Autor: taki  
Feito por taki

Aviso: utilize com moderação.

## Visao geral
GlobalSearchPro adiciona uma busca global profissional no Vencord, semelhante ao Discord Mobile. Ele abre um modal grande com abas para Mensagens, Midia e Arquivos, com filtro opcional por author_id e paginacao por cursor.

## Como funciona
- Usa somente o endpoint oficial do Discord: `POST /users/@me/messages/search/tabs`
- Sem scraping, sem varrer servidores manualmente e sem burlar rate limit
- Retorna apenas mensagens que sua conta tem permissao para ver

## Como instalar no Vencord
1. `pnpm install`
2. `pnpm build`
3. `pnpm dev`

## Como ativar
1. Abra as configuracoes do Vencord
2. Va em Plugins
3. Ative `GlobalSearchPro`

## Como usar
1. Clique no botao de busca na barra principal do chat
2. Digite o texto da busca
3. Opcional: preencha o author_id para filtrar por um usuario (pode ser voce)
4. Troque entre as abas de Mensagens, Midia e Arquivos
5. Use "Carregar mais" para paginar
6. Clique em um resultado para ir direto a mensagem

## Recompilar apos mudancas
1. `pnpm build`
2. Recarregue ou reinicie o Vencord
