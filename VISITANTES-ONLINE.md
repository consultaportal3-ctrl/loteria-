# Visitantes online

Abra `painel.html#online` e entre com a mesma senha administrativa usada em PIX direto e Pedidos.

- O painel consulta o servidor a cada 1 segundo.
- As páginas públicas enviam presença a cada 30 segundos enquanto estão visíveis. Um navegador é considerado online quando enviou presença nos últimos 90 segundos.
- Ao sair ou fechar a página, o navegador envia um aviso de saída. Quando a última aba ativa sai, o status muda para Offline na próxima consulta do painel (a cada 1 segundo), preservando a visita. Cada aba tem um identificador próprio; avisos atrasados de presença de uma aba encerrada são ignorados.
- Se o navegador for encerrado à força ou perder a conexão antes de enviar o aviso, permanece o prazo de 90 segundos como alternativa. A saída não pode ser garantida instantaneamente nessas situações.
- O identificador anônimo é compartilhado entre abas do navegador por um cookie de sessão. Não representa o nome nem a identidade da pessoa.
- Cidade, estado e país vêm dos cabeçalhos de geolocalização da Vercel. A cidade é aproximada e pode corresponder à operadora ou VPN. Quando indisponível, o painel informa que não foi identificada.
- O painel mostra a última página ou parte acessada, incluindo modalidades, combos, carrinho e formulário de PIX. Trocas de modalidade são enviadas imediatamente; a presença continua sendo renovada a cada 30 segundos.
- Em **Ver caminho e gerações**, cada visitante tem uma linha do tempo dos últimos 100 acessos e gerações, com horário. O histórico começa nesta atualização e não recupera ações antigas.
- **O que gerou** mostra os totais de apostas e PIX gerados. A linha do tempo detalha modalidade, concurso, números, trevos, palpites, colunas, time e mês quando disponíveis. O PIX inclui valor, referência do pedido e apostas relacionadas. Gerar PIX não confirma pagamento; a conferência continua em **Pedidos e clientes**.
- As apostas geradas são informadas pelo navegador. O registro de PIX é feito pelo servidor somente depois de criar o pedido com sucesso. Tentativas repetidas do mesmo evento não geram contagem duplicada enquanto ele estiver no histórico recente. Uma indisponibilidade do acompanhamento não interrompe a compra.
- Não são armazenados IP, coordenadas, nome, e-mail, CPF, códigos PIX, tokens de acesso ao pedido ou parâmetros de URL neste histórico. Os registros são acessíveis somente após login administrativo. A visita permanece salva mesmo após ficar offline; os totais permanecem e a linha do tempo mantém os 100 eventos mais recentes.
- A lista exibe 100 registros por página, com botões Anterior e Próxima, contagem online e total salvo. A própria página administrativa não entra na contagem.
- O botão **Limpar histórico de visitas** pede confirmação e apaga os registros salvos. Somente um administrador autenticado pode limpar. Visitantes ainda ativos aparecem novamente quando enviarem presença. Visitas que já expiraram antes da implantação desta versão não podem ser recuperadas.

O recurso usa o Redis já configurado para o PIX direto (`KV_REST_API_URL` e `KV_REST_API_TOKEN`, ou os equivalentes `UPSTASH_REDIS_REST_*`). Não exige outro serviço de localização. A geolocalização é habilitada apenas quando `VERCEL=1`.

## Resumo de toda a loja

`painel.html#visao` mostra os totais e as seis gerações mais recentes de todos os visitantes. `painel.html#vendas` exibe o histórico completo, em páginas de 50 registros. Ambas as telas exigem a mesma senha administrativa e atualizam a cada 5 segundos. Os números não dependem mais do armazenamento do navegador do administrador.

As apostas e os PIX gerados ficam em um histórico compartilhado no Redis. O registro identifica visitante, horário, modalidade, seleções e, no caso do PIX, valor e referência do pedido. O total em reais inclui somente PIX reais gerados; simulações ficam identificadas na lista. Gerar PIX não confirma recebimento.

Ao abrir o resumo, o servidor importa em lotes as gerações que ainda constam no histórico dos visitantes da versão anterior. Eventos antigos que já tinham saído do limite de 100 por visitante não podem ser recuperados. A partir desta versão, o histórico compartilhado de gerações é independente desse limite e da limpeza do histórico de visitas. Um PIX criado com sucesso também aparece no resumo se o cookie de acompanhamento estiver indisponível.

Testes: `npm.cmd test`. Verificação no navegador Windows: definir `BROWSER_CHECK_FILTER` como `visitors panel` e executar `node tests/browser-smoke.cjs`.
