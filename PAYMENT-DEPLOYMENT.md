# Pagamentos BlackCat em Node.js / Vercel

A pasta api usa JavaScript. O checkout suporta PIX direto por chave cadastrada no painel e, opcionalmente, BlackCat. O PIX direto ativo tem prioridade sobre o gateway. A simulacao fica restrita a desenvolvimento/preview. Na producao, sem uma opcao real configurada, o checkout informa a pendencia em vez de gerar codigo ficticio.

## PIX direto: cadastrar sua chave no painel

Esta opcao gera um BR Code estatico e um QR Code PNG localmente, com chave PIX, valor recalculado no servidor e referencia unica do pedido. Nao chama a BlackCat e nao exige CNPJ do operador quando a chave usada e e-mail, telefone, CPF ou aleatoria. A chave precisa estar registrada no banco do titular informado. A validacao do aplicativo e de formato; somente o aplicativo bancario consulta o titular real no DICT. O cliente deve conferir o titular e o valor antes de pagar.

1. Mantenha o Redis conectado ao projeto Vercel. Sao aceitos KV_REST_API_URL/KV_REST_API_TOKEN ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. O token precisa permitir escrita.
2. Na Vercel, adicione ADMIN_PASSWORD como Secret em Production, com uma senha nova, exclusiva, de pelo menos 16 caracteres, e faca Redeploy. Alternativamente, configure ADMIN_PASSWORD_HASH no formato scrypt gerado por node lib/admin-password.js. Nao configure os dois com senhas diferentes: o hash tem prioridade. Nunca compartilhe a senha no chat.
3. Abra /painel.html#pix no dominio da loja e entre com a senha administrativa. Essa senha fica apenas no servidor e nao e salva pelo aplicativo no armazenamento do navegador.
4. Escolha o tipo da chave, informe a chave registrada no banco, o nome do titular (ate 25 caracteres) e a cidade (ate 15). Para telefone, use o formato internacional +55 seguido do DDD e numero. Marque a confirmacao de titularidade e Ativar PIX direto, e salve.
5. Abra o checkout. O PIX direto ativado no Redis tem prioridade sobre a BlackCat. As mudancas da chave pelo painel passam a valer para novos pedidos sem novo deploy. O comprador informa nome e e-mail; nao sao solicitados CPF e telefone no modo direto.

O recebimento NAO e confirmado automaticamente. A geracao do codigo, um clique do cliente ou uma imagem de comprovante nao aprovam pagamentos. Em /painel.html#pedidos, confira o credito e o valor no extrato bancario, informe a referencia da transacao e confirme manualmente. O estado salvo sera manual_confirmed, nunca uma confirmacao automatica do banco. O registro da aposta e a emissao do bilhete continuam sendo etapas separadas da operacao.

Os codigos estaticos nao expiram e nao podem ser revogados pelo painel. Trocar a chave nao muda codigos/pedidos ja criados. Repetir o mesmo requestId preserva o pedido original. Os pedidos e as configuracoes ficam no Redis sem expiracao automatica; configure backups e retencao conforme sua operacao. Sessoes administrativas usam cookie Secure/HttpOnly/SameSite=Strict, expiram em oito horas e exigem CSRF e mesma origem nas alteracoes. O login limita cinco tentativas em 15 minutos por endereco do peer, podendo compartilhar o limite atras de proxy.

Rotas adicionais: /api/pix-settings?action=session, settings ou orders para GET; acoes POST login, logout, save e confirm com CSRF. Configuracao, listagem e confirmacao exigem login. O status publico de um pedido direto exige seu token privado DP.; ele permite apenas consulta, sem aprovacao ou alteracao do recebedor. Webhooks BlackCat nao confirmam pedidos diretos.

O gerador usa qrcode instalado via npm e verifica CRC16 conforme o Manual de Padroes para Iniciacao do Pix do Banco Central. Os testes decodificam o PNG com um leitor independente e conferem o codigo completo. Nenhum pagamento real foi feito durante os testes.

## Ativar o PIX BlackCat na Vercel (opcional)

1. Crie ou conecte um banco Upstash Redis persistente ao projeto na Vercel. Utilize o token de leitura e escrita. Os pedidos nao usam SQLite nem o disco temporario das funcoes. A integracao da Vercel pode criar KV_REST_API_URL e KV_REST_API_TOKEN: o codigo aceita esses nomes automaticamente quando UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN nao estiverem definidos. KV_REST_API_READ_ONLY_TOKEN nao serve para gravar pedidos.
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

4. Publique um novo deployment. As funcoes Node.js devem ser incluidas e a raiz deve corresponder a este repositorio. A Vercel instala as dependencias do package.json/package-lock.json; para desenvolvimento local, execute npm ci. Chaves privadas da API ficam somente no servidor; nunca use prefixos publicos nem as coloque em HTML ou JavaScript do navegador. Arquivos .env nao sao carregados automaticamente pelo codigo.
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

Em desenvolvimento ou preview, com BLACKCAT_MODE=simulation (ou sem modo configurado), /api/checkout-info identifica a simulacao. O navegador usa /api/blackcat-simulation?action=... para criar e consultar fixtures. O codigo SIMULACAO-SEM-VALOR nao e um PIX pagavel, nao utiliza credenciais nem transmite dados a BlackCat. Nao use dados reais na simulacao. Com VERCEL_ENV=production, tanto o checkout em modo simulado quanto o endpoint de simulacao retornam HTTP 503. O arquivo .env.example exemplifica agora a configuracao de modo live.

Variaveis opcionais: BLACKCAT_SIMULATION_SCENARIO=paid (pending, cancelled, expired, rejected) e BLACKCAT_SIMULATION_DELAY_SECONDS=15 (0 a 600). A funcao de simulacao continua rejeitando outros modos e nunca encaminha fixtures para cobrancas reais.

## Painel historico Node.js

/api/admin preserva a consulta ao store.sqlite do painel anterior. Requer Node.js 22.13 ou superior com node:sqlite, HTTPS, APP_DATA_DIR absoluto fora da raiz publica e volume persistente. SQLite nao serve como armazenamento persistente na Vercel. Para esse painel, use um servidor Node.js com volume persistente; o checkout real na Vercel utiliza Redis separadamente.

ADMIN_PASSWORD_HASH utiliza scrypt. Gere com node lib/admin-password.js, fornecendo a senha pela entrada padrao e finalizando com EOF (Ctrl+Z e Enter no Windows; Ctrl+D no Linux). Configure somente o hash produzido no servidor. Hashes/sessoes PHP antigos nao sao reutilizados. Sessoes expiram em oito horas e o login limita cinco tentativas por 15 minutos por endereco do peer conectado (pode ser compartilhado atras de proxy).

## Verificacao

    npm ci
    npm test
    node tests/browser-smoke.cjs

Em ambientes que restringem subprocessos, Node.js recente permite executar os testes com --test-isolation=none. O teste de navegador usa Chrome/Edge em perfil separado e ambiente simulado, sem chamadas a contas reais.

Documentacao oficial consultada:
- https://docs.blackcatoficial.com/
- https://upstash.com/docs/redis/features/restapi
- https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
