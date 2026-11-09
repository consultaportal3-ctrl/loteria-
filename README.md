# L7 PG — Portal de modalidades

Site em HTML, CSS e JavaScript, com carrinho de combinações, PIX direto por chave cadastrada no painel e integração opcional BlackCat em funções Node.js para Vercel.

- `index.html`: entrada do site.
- `home.html` e `compra-bolao/`: páginas de modalidades e combinações.
- `carrinho.html`: carrinho e checkout.
- `api/` e `lib/`: funções do servidor, pagamentos e persistência.
- `painel.html#pix`: cadastro protegido da chave, nome e cidade do titular. Requer ADMIN_PASSWORD (Secret, mínimo 16 caracteres) ou ADMIN_PASSWORD_HASH e Redis conectado ao projeto.
- `painel.html#pedidos`: pedidos do PIX direto e confirmação manual após conferir o crédito no extrato.

Para configurar credenciais, armazenamento Redis, identidade do recebedor e modo de pagamento, siga [PAYMENT-DEPLOYMENT.md](PAYMENT-DEPLOYMENT.md). As chaves privadas devem ficar nas variáveis do servidor. Subir os arquivos ao GitHub não ativa os pagamentos automaticamente.

O PIX direto ativado no painel tem prioridade e gera o QR localmente, sem chamar gateway. A confirmação do recebimento é manual; gerar o código não confirma pagamento. Chaves precisam estar registradas no banco e o cliente deve conferir o titular no aplicativo. A confirmação do PIX não registra apostas nem emite bilhetes: essa etapa depende da operação do vendedor e não está integrada neste projeto. Sem PIX direto ativo, o checkout mantém a integração BlackCat e suas validações; simulação só em desenvolvimento e preview.

## Verificação local

Com Node.js 22.13 ou superior:

```sh
npm ci
npm test
node tests/browser-smoke.cjs
```

Os testes usam dados fictícios e não movimentam dinheiro. Um servidor estático permite visualizar as páginas; as rotas de API exigem um ambiente Node.js compatível ou a Vercel.
