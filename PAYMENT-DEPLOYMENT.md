# Simulador local BlackCat

Este projeto usa um simulador proprio baseado no contrato publico https://docs.blackcatoficial.com/ . Nao e o sandbox oficial BlackCat e nao transmite requisicoes ao provedor. Nao gera PIX pagavel, cobranca, saque, bilhete ou aposta. Nao configure chaves reais.

O layout e os campos existentes foram preservados. As mensagens identificam a simulacao. Nome e e-mail sao validados e descartados: nao sao armazenados, registrados em logs nem enviados ao gateway. Use somente dados ficticios. Nao ha consulta de CPF.

## Vercel

api/blackcat-simulation.js e uma funcao Node.js sem dependencias externas, publicada pelo fluxo Git da Vercel. A raiz do projeto deve corresponder a raiz deste repositorio e a configuracao de saida nao deve excluir api/. As paginas permanecem em HTML estatico.

Nao e necessario cadastrar chave, banco ou segredo. O simulador e stateless e funciona entre instancias diferentes. O unico modo aceito e simulation; qualquer outro BLACKCAT_MODE retorna HTTP 503. Nao existe implementacao de modo real.

Variaveis opcionais:
- BLACKCAT_MODE=simulation
- BLACKCAT_SIMULATION_SCENARIO=paid (tambem aceita pending, cancelled, expired, rejected)
- BLACKCAT_SIMULATION_DELAY_SECONDS=15 (inteiro entre 0 e 600)

Mudancas de variaveis na Vercel precisam de novo deployment. Arquivos .env nao sao carregados pelo codigo. Os demais campos de .env.example pertencem ao painel PHP legado, caso hospedado separadamente; nao sao necessarios para a simulacao.

## Rotas

Todas as respostas usam JSON e Cache-Control: no-store.

- GET /api/blackcat-simulation?action=checkout-info: identifica ambiente simulado.
- GET /api/blackcat-simulation?action=business-info: informa que nao existe recebedor financeiro.
- POST /api/blackcat-simulation?action=create-payment: recebe {buyer: {name, email}, items}. Requer JSON e Origin com o host do site. Recalcula valores pelas regras das modalidades e ignora os precos enviados pelo navegador.
- GET /api/blackcat-simulation?action=payment-status&token=...: retorna estados prefixados com simulated_.

O gatewayFixture reproduz campos success, data.transactionId, status, amount e paymentData do contrato BlackCat. Seus dados de cliente sao fixtures ficticios, nunca transmitidos. A imagem e ilustrativa e nao pagavel. O codigo comeca com SIMULACAO-SEM-VALOR: e nao e um BR Code PIX.

O token SIM. e apenas um fixture NAO ASSINADO, sem dados do comprador. Nao autentica clientes nem comprova pagamento. Pode ser alterado pelo visitante para explorar estados ficticios; nenhum consumidor deve trata-lo como pedido financeiro ou autorizacao para liberar produtos. Nao e gravado no painel administrativo e nunca limpa o carrinho. As simulacoes expiram apos dez minutos.

## Testes

Em uma maquina com Node.js:

    node --test tests/blackcat-simulation.test.cjs

Depois do deployment, abra o checkout com uma combinacao no carrinho. Informe dados ficticios e aceite a simulacao. Confira a imagem nao pagavel, a copia do codigo e a transicao de estado apos 15 segundos. O carrinho deve permanecer intacto. Repita com outros cenarios nas variaveis de ambiente.

## Gateway anterior e dados historicos

Os endpoints PHP antigos de criacao, configuracao, status e webhook respondem HTTP 410. O cliente HTTP e as variaveis de credenciais do gateway anterior foram removidos. Nao ha processamento de webhooks: notificacoes externas nao aprovam nada.

O painel PHP e seu banco foram preservados para consultar registros historicos. Nao recebem novos registros de simulacao. O campo historico mp_payment_id permanece por compatibilidade de dados e nao representa uma integracao ativa. PHP e SQLite nao sao usados pelo simulador Node.js na Vercel.

Para um ambiente oficial de homologacao, obtenha as instrucoes especificas do provedor. A API publica informada e de producao. Cobrancas reais e emissao de bilhetes nao estao implementadas.

## Testes de navegador

O teste tests/browser-smoke.cjs usa Chrome ou Edge em modo headless e um servidor HTTP local. Requer Node.js com WebSocket nativo. Nao usa dados reais e nao chama o gateway.

    node tests/browser-smoke.cjs

O caminho do navegador pode ser informado por BROWSER_PATH. Se a maquina restringir a criacao de subprocessos, inicie um navegador headless com perfil de teste separado e defina BROWSER_CDP_PORT com a porta de depuracao desse processo. Nunca use a porta de um navegador pessoal.

O teste verifica entrada e cookies, rotas das dez modalidades, carrinho persistido, checkout, respostas atrasadas, falha de carregamento do checkout, limites e precos dos sete combos, menu responsivo e largura das paginas em 320, 390, 768 e 1280 pixels. Cada execucao usa dados ficticios e mantem o simulador isolado.
