# Dashboard Midia Paga

Dashboard de mídia paga da Snugg com seção **Top 5 Criativos do Mês** conectada ao Meta Ads por uma rota server-side.

## Como rodar

```bash
META_ADS_MCP_TOKEN="seu_token" npm start
```

Acesse o endereço exibido no terminal. Por padrão, a API usa a conta **Snugg NOVA** (`4437833576442216`) e o período **01/06/2026 a 16/06/2026**.

Para trocar a conta ou o período:

```bash
META_ADS_ACCOUNT_ID="id_da_conta" TOP_CREATIVES_SINCE="2026-06-01" TOP_CREATIVES_UNTIL="2026-06-16" META_ADS_MCP_TOKEN="seu_token" npm start
```

## Top 5 Criativos do Mês

A rota `/api/meta-ads/top-creatives` busca anúncios no nível de anúncio, filtra investimento acima de R$100 e pelo menos 3 vendas, ordena por vendas, ROAS e menor CPA, e tenta anexar preview visual clicável do criativo pelo Meta Ads.

## Estrutura

- `index.html`: página do relatório.
- `styles.css`: estilos do dashboard.
- `data.js`: base de dados do período.
- `app.js`: edição em tela, persistência local, gráficos e cards de criativos.
- `server.js`: servidor local e rota tratada para consultar o Meta Ads sem expor token no frontend.
