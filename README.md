# Vasco PG — prévia de loja de ventiladores

Site estático em HTML, CSS e JavaScript. Sem backend de pagamentos ou cadastro de clientes.

- `index.html` e `ventilador.html`: produto, preço informado de R$ 63,00 por unidade e entrega informada de 7 dias.
- `carrinho-loja.html`: quantidade, remoção e subtotal. O navegador guarda apenas o identificador do produto e a quantidade.
- `checkout-loja.html`: resumo e formulário demonstrativo de endereço fictício. Nenhum endereço é salvo ou enviado; os campos são apagados ao sair da página.
- `previa.html`: visualização da loja, carrinho e checkout em diferentes tamanhos de tela.

O cadastro ainda precisa de modelo, voltagem, foto real, disponibilidade, frete, identificação do vendedor, atendimento e políticas. O pagamento está desativado e nenhum pedido é criado. Não coloque chaves privadas no HTML ou JavaScript.

## Desenvolvimento

Na pasta do projeto, execute `python -m http.server 8000` e abra `http://localhost:8000`.

O projeto pode ser publicado como site estático na Vercel, sem comando de build e sem variáveis de API.

## Verificação

Com Node.js instalado, execute `node tests/browser-smoke.cjs`. O script usa um navegador separado em modo headless; `BROWSER_PATH` pode indicar Chrome ou Edge e `BROWSER_CDP_PORT` pode apontar para uma sessão de teste já aberta. Os testes usam apenas dados fictícios.
