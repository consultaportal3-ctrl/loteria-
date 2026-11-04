# Configuração do checkout PIX de teste

Este checkout está permanentemente limitado a credenciais de teste do Mercado Pago. Ele não emite apostas ou bilhetes oficiais. Não altere o bloqueio para aceitar credenciais de produção sem autorização jurídica documentada e uma revisão independente de segurança.

## Requisitos

- PHP 8.1 ou superior, com cURL, PDO SQLite e mbstring.
- HTTPS para o site, para a URL de notificação e para as páginas de privacidade e termos.
- `APP_DATA_DIR` criado previamente, gravável pelo usuário do PHP e fora da raiz pública do site. Restrinja o acesso à pasta e ao banco SQLite ao usuário do serviço. Nunca use uma pasta dentro do repositório ou `public_html`.
- Uma aplicação e credenciais de teste configuradas no painel oficial do Mercado Pago. Nunca use nem cole tokens no código, no navegador, no Git ou nesta documentação.

## Variáveis do servidor

Use `.env.example` como lista de nomes, mas injete valores pelo gerenciador de segredos do host ou pelo ambiente do processo PHP. O PHP deste projeto não carrega arquivos `.env` automaticamente.

- `PAYMENT_MODE`: deve ser `test`; qualquer outro modo é recusado.
- `MP_ACCESS_TOKEN`: token de teste iniciado por `TEST-`.
- `MP_WEBHOOK_SECRET`: chave de assinatura das notificações Webhook da aplicação Mercado Pago.
- `APP_BASE_URL`: URL HTTPS pública do site de teste, sem barra final.
- `APP_DATA_DIR`: diretório privado previamente criado fora da raiz pública.
- `BUSINESS_PUBLIC_NAME`, `BUSINESS_LEGAL_NAME`, `BUSINESS_CNPJ`, `BUSINESS_ADDRESS` e `BUSINESS_CONTACT_EMAIL`: dados verdadeiros do operador, mostrados ao cliente antes de criar o pagamento. O CNPJ deve seguir o formato atual de 14 caracteres da Receita Federal (12 alfanuméricos e 2 dígitos finais) e ser conferido pelo operador; o sistema verifica o formato, mas não consegue confirmar a titularidade.
- `BUSINESS_PRIVACY_URL` e `BUSINESS_TERMS_URL`: políticas públicas, válidas e servidas por HTTPS; aparecem antes do envio dos dados do cliente.
- `ADMIN_PASSWORD_HASH`: hash criado com `password_hash()` em ambiente privado. Não use a senha em texto puro como valor desta variável.

Se a conexão TLS terminar em um proxy reverso, configure o servidor PHP para reconhecer corretamente a requisição HTTPS. Não confie cegamente em cabeçalhos de proxy enviados pelo cliente.
O endpoint público `APP_BASE_URL/api/business-info.php` disponibiliza somente os dados comerciais e as políticas do operador para o rodapé do site. Configure e confira esses dados antes de publicar o checkout.

## Configuração e teste

1. Publique em um ambiente de homologação HTTPS e configure as variáveis com dados reais e verificáveis do operador. Sem isso, o checkout deve permanecer indisponível.
2. No painel do Mercado Pago, configure Webhooks de pagamentos apontando para `APP_BASE_URL/api/webhook.php`, copie a chave secreta da aplicação para o gerenciador de segredos e mantenha o token de teste.
3. Abra `APP_BASE_URL/api/checkout-info.php`. A resposta deve conter apenas as informações públicas do operador e indicar `environment: test`. Erros de configuração são intencionais e devem ser resolvidos no servidor, nunca contornados no navegador.
4. No site, gere um pedido com dados de teste, confira o nome/CNPJ/endereço e as políticas antes de prosseguir, valide o QR PIX no ambiente de teste do Mercado Pago e confirme que o pedido aparece em `APP_BASE_URL/painel.html#pedidos`.
5. Teste também uma assinatura Webhook inválida (deve ser recusada), reenvio de uma notificação válida, divergência de valor/moeda/pedido e estados recusado, expirado e reembolsado. Verifique os logs do PHP e o banco fora da raiz pública.

Não use dados pessoais reais de clientes durante testes. O nome e o e-mail informados no checkout são enviados ao Mercado Pago no ambiente de testes e armazenados junto ao pedido.

## Requisitos antes de qualquer operação real

Pagamentos de produção continuam bloqueados no código. Antes de sequer considerar alterar esse bloqueio, confirme com assessoria jurídica e com as autoridades competentes se a atividade pretendida pode ser oferecida, quais autorizações/licenças são necessárias e se o operador está habilitado para vender ou intermediar apostas lotéricas. Obtenha também a aprovação comercial do Mercado Pago para a atividade, credenciais de produção, políticas finais, controles de privacidade/LGPD, suporte ao consumidor, segurança operacional e uma revisão jurídica e técnica independente.

Não apresente este site como oficial, afiliado ou autorizado pela CAIXA sem autorização verificável. A aprovação de uma cobrança por um provedor de pagamentos, por si só, não transforma uma combinação em aposta ou bilhete oficial.
