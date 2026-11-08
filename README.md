# L7 PG — Portal de modalidades

Site em HTML, CSS e JavaScript, com carrinho de combinações e integração PIX BlackCat em funções Node.js para Vercel.

- `index.html`: entrada do site.
- `home.html` e `compra-bolao/`: páginas de modalidades e combinações.
- `carrinho.html`: carrinho e checkout.
- `api/` e `lib/`: funções do servidor, pagamentos e persistência.
- `painel.html`: painel local e consulta ao banco histórico, conforme as limitações da documentação.

Para configurar credenciais, armazenamento Redis, identidade do recebedor e modo de pagamento, siga [PAYMENT-DEPLOYMENT.md](PAYMENT-DEPLOYMENT.md). As chaves privadas devem ficar nas variáveis do servidor. Subir os arquivos ao GitHub não ativa os pagamentos automaticamente.

A simulação está disponível em desenvolvimento e preview. Na produção da Vercel, é necessário configurar o modo live e as credenciais; sem isso, o checkout informa configuração pendente. A integração real depende da configuração da conta BlackCat e de validação operacional. A confirmação do PIX não registra apostas nem emite bilhetes: essa etapa depende da operação do vendedor e não está integrada neste projeto.

## Verificação local

Com Node.js 22.13 ou superior:

```sh
npm test
node tests/browser-smoke.cjs
```

Os testes usam dados fictícios e não movimentam dinheiro. Um servidor estático permite visualizar as páginas; as rotas de API exigem um ambiente Node.js compatível ou a Vercel.
