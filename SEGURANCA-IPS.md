# Segurança e IPs

Abra `painel.html#seguranca` e entre com a senha administrativa. A seção mostra os 100 IPs com atividade mais recente, o total de páginas acessadas, a contagem no minuto atual, o último caminho e as tentativas bloqueadas. O servidor mantém até 1.000 IPs recentes; imagens, estilos e scripts não entram na contagem de páginas.

O formulário permite bloquear um endereço IPv4 ou IPv6 por 15 minutos, 1 hora, 24 horas, 7 dias ou até desbloquear. Também é possível bloquear por 24 horas diretamente na lista. O bloqueio vale para todas as pessoas que compartilham aquele IP. O próprio IP do administrador não pode ser bloqueado manualmente.

O bloqueio automático começa desligado. Quando ativado, bloqueia temporariamente o IP ao exceder o limite configurado de páginas por minuto. A janela é o minuto do relógio do servidor; não é uma janela móvel de 60 segundos. É possível escolher de 10 a 1.000 acessos e duração de 5 minutos, 15 minutos, 1 hora ou 24 horas. Desativar o modo automático não remove bloqueios já existentes; use **Desbloquear** ou aguarde o prazo.

O bloqueio é verificado pelo proxy da Vercel antes das páginas e das APIs da loja, inclusive as de geração e pagamento. Um bloqueio manual retorna HTTP 403; um automático retorna HTTP 429 com `Retry-After`. Respostas bloqueadas não devem ser armazenadas em cache. A presença do visitante detecta o bloqueio e recarrega a página para mostrar a restrição.

O painel, suas APIs administrativas, os arquivos estáticos e os webhooks de pagamento ficam fora do bloqueio. Isso permite ao administrador entrar para desfazer um bloqueio e mantém a recepção de notificações do gateway. As APIs administrativas continuam exigindo sua própria autenticação e CSRF. Em indisponibilidade do Redis, o proxy permite a navegação para não derrubar a loja; o bloqueio não substitui o firewall da hospedagem ou proteção contra DDoS.

Em produção, o endereço vem dos cabeçalhos de IP fornecidos pela Vercel. Fora da Vercel, cabeçalhos de encaminhamento enviados pelo cliente não são confiados; o endereço local vem da conexão. Endereços IPv6 são normalizados para que grafias equivalentes correspondam ao mesmo bloqueio.

Os IPs são armazenados separadamente do histórico de visitantes e ficam visíveis somente após login administrativo. Parâmetros de URL não são registrados nessa lista. A coleta começa nesta versão, sem recuperação de IPs de acessos antigos.

Implementação baseada na documentação oficial de [Routing Middleware](https://vercel.com/docs/routing-middleware/getting-started) e dos [cabeçalhos de requisição da Vercel](https://vercel.com/docs/headers/request-headers). O projeto usa `proxy.mjs`, declarado em `vercel.json`, e o Redis já utilizado pela loja.
