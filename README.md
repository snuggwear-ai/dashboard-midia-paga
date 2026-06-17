# Dashboard Midia Paga

Dashboard de mídia paga da Snugg com seção **Top 5 Criativos do Mês** conectada ao Meta Ads por uma rota server-side.

## Como rodar

```bash
META_ADS_MCP_TOKEN="seu_token" npm start
```

Acesse o endereço exibido no terminal. Por padrão, a API usa a conta **Snugg NOVA** (`4437833576442216`) e o período **01/06/2026 a 16/06/2026**.

Para trocar a conta padrão:

```bash
META_ADS_ACCOUNT_ID="id_da_conta" META_ADS_MCP_TOKEN="seu_token" npm start
```

O token precisa ter acesso à conta de anúncios e permissão `ads_read` ou `ads_management`. Se o Meta retornar erro de permissão, o dono da conta precisa liberar o app/usuário no Business Manager e gerar um novo token.

## Top 5 Criativos do Mês em tempo real

A seção `Top 5 Criativos do Mês` consulta o Meta Ads pelo servidor local, sem expor token no navegador. Os filtros de período, conta, campanha, conjunto, investimento mínimo, vendas mínimas, status e ordenação ficam dentro do site e são enviados para a rota segura quando você clica em `Atualizar dados`.

O ranking padrão usa vendas como critério principal, ROAS como desempate e CPA menor como terceiro critério. Cada card tenta carregar o preview visual do criativo e mostra investimento, vendas, ROAS, CPA, CTR, entrega e status.

## Estrutura

- `index.html`: página do relatório.
- `styles.css`: estilos do dashboard.
- `data.js`: base de dados do período.
- `app.js`: edição em tela, persistência local, gráficos e cards de criativos.
- `server.js`: servidor local e rota tratada para consultar o Meta Ads sem expor token no frontend.
