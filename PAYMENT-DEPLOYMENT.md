# Pagamentos BlackCat em Node.js / Vercel

A pasta api usa JavaScript. O checkout suporta simulacao local e PIX real BlackCat. O modo padrao continua sendo simulation ate as credenciais de producao serem configuradas. Remover avisos visuais ou mudar somente BLACKCAT_MODE nao conecta uma conta de pagamentos.

## Ativar o PIX real na Vercel

1. Crie ou conecte um banco Upstash Redis persistente ao projeto na Vercel. Utilize o token de leitura e escrita. Os pedidos nao usam SQLite nem o disco temporario das funcoes.
2. Nas variaveis de ambiente de Production da Vercel, configure:

    BLACKCAT_MODE=live
    BLACKCAT_API_KEY=<chave da sua conta BlackCat>
    BLACKCAT_WEBHOOK_SECRET=<segredo aleatorio com pelo menos 32 caracteres>
    APP_BASE_URL=https://seu-dominio.com
    UPSTASH_REDIS_REST_URL=https://seu-banco.upstash.io
    UPSTASH_REDIS_REST_TOKEN=<token privado de leitura e escrita>
    BUSINESS_PUBLIC_NAME=L7 PG
    BUSINESS_LEGAL_NAME=<razao social>
    BUSINESS_CNPJ=<CNPJ sem pontuacao>
    BUSINESS_ADDRESS=<endereco>
    BUSINESS_CONTACT_EMAIL=<email de atendimento>
    BUSINESS_PRIVACY_URL=https://seu-dominio.com/privacidade
    BUSINESS_TERMS_URL=https://seu-dominio.com/termos

3. Gere o segredo do webhook localmente, por exemplo com:

    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"

4. Publique um novo deployment. As funcoes Node.js devem ser incluidas e a raiz deve corresponder a este repositorio. Nao e necessario instalar dependencias. Chaves ficam somente no servidor; nunca use prefixos publicos nem as coloque em HTML ou JavaScript do navegador. Arquivos .env nao sao carregados automaticamente pelo codigo.
5. Abra o checkout. O servidor confere o CNPJ configurado com o recebedor da conta BlackCat. O formulario solicita nome, email, telefone e CPF validos. Confira tambem se a sua conta de gateway esta habilitada para os produtos vendidos.

Nao foi feita nenhuma cobranca real durante a implementacao. A integracao foi testada com respostas locais controladas. A homologacao na sua conta depende das configuracoes acima e de um teste operacional de ponta a ponta, incluindo conferencia no painel BlackCat.

## Rotas reais

- GET /api/checkout-info: ambiente e identidade do operador; consulta o vendedor BlackCat no modo live.
- GET /api/business-info: identidade configurada nas variaveis BUSINESS_*.
- POST /api/create-payment: JSON {requestId, consent:true, buyer:{name,email,phone,cpf}, items}. Requer origem do proprio site e application/json. Retorna orderToken, orderId, amount em centavos, qrCode, qrCodeImage, expiresAt e status.
- GET /api/payment-status?token=...: consulta novamente o gateway, confere identificador, metodo e valor e atualiza o pedido persistente.
- POST /api/webhook?secret=...: notificacao com transactionId e externalReference. A URL com segredo e enviada automaticamente a BlackCat no campo postbackUrl. O segredo deve ser protegido tambem nos logs de infraestrutura. O evento recebido nunca aprova sozinho: o servidor consulta a API autenticada da BlackCat.

Os endpoints antigos com extensao .php foram removidos.

## Pedidos, repeticoes e conciliacao

O servidor recalcula os precos e ignora valores enviados pelo navegador. O requestId deve ser um UUID aleatorio e funciona como token privado do pedido. O navegador o preserva na sessao para reutilizar o mesmo pedido ao fechar e reabrir o checkout. Nao compartilhe esse token.

O Redis armazena o pedido antes de chamar a BlackCat. Uma chamada de criacao com resposta incerta nunca e repetida automaticamente: o pedido fica em conferencia, mesmo que o gateway possa ter criado uma cobranca. Confira a referencia externa no painel BlackCat e o webhook antes de iniciar outro pedido. Nao limpe o armazenamento do navegador nem troque o identificador para forcar nova cobranca. A protecao contra repeticoes se aplica ao mesmo identificador; outra sessao do navegador pode iniciar um novo pedido.

CPF e telefone sao enviados ao gateway e nao sao guardados pelo aplicativo. Pedidos guardam nome, email, combinacoes, valores, referencia externa, transacao e dados do PIX. A impressao digital dos dados impede reutilizar o identificador com outro comprador ou carrinho. Nao ha logs de credenciais ou corpos de requisicoes no codigo.

Os registros payments:order:*, payments:reference:*, payments:transaction:* e o indice payments:orders permanecem no Redis sem expiracao automatica. Configure backups e uma politica de retencao/exclusao adequada a sua operacao. O painel de pedidos SQLite antigo nao lista esses pedidos: consulte o painel BlackCat pela referencia externa e use um acesso administrativo restrito ao Redis para conciliacao tecnica. Nunca exponha o token Redis no navegador.

## Pagamento e registro da aposta

A integracao implementa a cobranca e sua confirmacao. Nao existe neste repositorio uma API de registro de apostas ou emissao de bilhetes. Por isso, mesmo com status approved, fulfillmentStatus permanece awaiting_registration. O checkout informa que o registro e a entrega dependem do operador; ele nao apresenta PIX pago como bilhete emitido nem limpa o carrinho automaticamente. A entrega/registro efetivo deve ser realizado pela sua operacao ou por uma integracao especifica futura.

## Simulacao local

Com BLACKCAT_MODE=simulation (ou sem modo configurado), /api/checkout-info identifica a simulacao. O navegador usa /api/blackcat-simulation?action=... para criar e consultar fixtures. O codigo SIMULACAO-SEM-VALOR nao e um PIX pagavel, nao utiliza credenciais nem transmite dados a BlackCat. Nao use dados reais na simulacao.

Variaveis opcionais: BLACKCAT_SIMULATION_SCENARIO=paid (pending, cancelled, expired, rejected) e BLACKCAT_SIMULATION_DELAY_SECONDS=15 (0 a 600). A funcao de simulacao continua rejeitando outros modos e nunca encaminha fixtures para cobrancas reais.

## Painel historico Node.js

/api/admin preserva a consulta ao store.sqlite do painel anterior. Requer Node.js 22.13 ou superior com node:sqlite, HTTPS, APP_DATA_DIR absoluto fora da raiz publica e volume persistente. SQLite nao serve como armazenamento persistente na Vercel. Para esse painel, use um servidor Node.js com volume persistente; o checkout real na Vercel utiliza Redis separadamente.

ADMIN_PASSWORD_HASH utiliza scrypt. Gere com node lib/admin-password.js, fornecendo a senha pela entrada padrao e finalizando com EOF (Ctrl+Z e Enter no Windows; Ctrl+D no Linux). Configure somente o hash produzido no servidor. Hashes/sessoes PHP antigos nao sao reutilizados. Sessoes expiram em oito horas e o login limita cinco tentativas por 15 minutos por endereco do peer conectado (pode ser compartilhado atras de proxy).

## Verificacao

    node --test tests/blackcat-simulation.test.cjs tests/api.test.cjs tests/blackcat-payments.test.cjs
    node tests/browser-smoke.cjs

Em ambientes que restringem subprocessos, Node.js recente permite executar os testes com --test-isolation=none. O teste de navegador usa Chrome/Edge em perfil separado e ambiente simulado, sem chamadas a contas reais.

Documentacao oficial consultada:
- https://docs.blackcatoficial.com/
- https://upstash.com/docs/redis/features/restapi
