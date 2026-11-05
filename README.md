# Vasco PG — loja de ventiladores

Site em HTML, CSS e JavaScript, com checkout PIX BlackCat por função Node.js compatível com Vercel.

- `index.html` e `ventilador.html`: produto a R$ 63,00 por unidade; modelo e voltagem ainda a confirmar.
- `carrinho-loja.html`: quantidade, remoção e subtotal; o navegador guarda o produto e a quantidade.
- `checkout-loja.html`: comprador, entrega, total com frete, PIX copia e cola e consulta do pagamento.
- `api/blackcat.js`: integração de servidor, validação dos valores e recibos de consulta assinados.
- `previa.html`: visualização das páginas em diferentes tamanhos.

O pagamento permanece indisponível até configurar as variáveis obrigatórias e publicar a função de servidor. Siga `PAYMENT-DEPLOYMENT.md`. Nenhuma chave privada deve ser incluída nos arquivos do site. A integração não foi validada com credenciais reais.

A entrega é acompanhada pelo vendedor no painel do gateway; não existe despacho automático nem banco de pedidos neste projeto. Complete foto, modelo, voltagem, disponibilidade, identificação do vendedor, atendimento e políticas da loja.

## Desenvolvimento e verificação

`python -m http.server 8000` permite visualizar as páginas, mas não executa a API. O pagamento requer hospedagem com funções Node.js e as variáveis indicadas na documentação.

Com Node.js 22 ou superior, execute `node tests/pagamento.test.cjs`. Para verificar as páginas com Chrome ou Edge, execute `node tests/browser-smoke.cjs`. São usados somente fixtures locais, sem cobranças reais.
![alt text](image.png)