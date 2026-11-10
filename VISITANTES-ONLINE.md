# Visitantes online

Abra `painel.html#online` e entre com a mesma senha administrativa usada em PIX direto e Pedidos.

- O painel consulta o servidor a cada 10 segundos.
- As páginas públicas enviam presença a cada 30 segundos enquanto estão visíveis. Um navegador é considerado online quando enviou presença nos últimos 90 segundos.
- O identificador anônimo é compartilhado entre abas do navegador por um cookie de sessão. Não representa o nome nem a identidade da pessoa.
- Cidade, estado e país vêm dos cabeçalhos de geolocalização da Vercel. A cidade é aproximada e pode corresponder à operadora ou VPN. Quando indisponível, o painel informa que não foi identificada.
- Não são armazenados IP, coordenadas, nome, e-mail, parâmetros de URL ou histórico de navegação. Cada atualização substitui a página anterior; os registros expiram após 90 segundos sem atualização.
- A lista exibe até 500 visitantes recentes e informa a contagem total. A própria página administrativa não entra na contagem.

O recurso usa o Redis já configurado para o PIX direto (`KV_REST_API_URL` e `KV_REST_API_TOKEN`, ou os equivalentes `UPSTASH_REDIS_REST_*`). Não exige outro serviço de localização. A geolocalização é habilitada apenas quando `VERCEL=1`.

Testes: `npm.cmd test`. Verificação no navegador Windows: definir `BROWSER_CHECK_FILTER` como `visitors panel` e executar `node tests/browser-smoke.cjs`.
