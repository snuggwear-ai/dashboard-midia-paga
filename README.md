# Dashboard Midia Paga

Dashboard de mídia paga da Snugg com seção **Top 5 Criativos do Mês** conectada ao Meta Ads por uma rota server-side.

## Como rodar

```bash
META_ADS_MCP_TOKEN="seu_token" npm start
```

Acesse o endereço exibido no terminal. Por padrão, a API usa a conta **Snugg NOVA** (`4437833576442216`).

Para trocar a conta:

```bash
META_ADS_ACCOUNT_ID="id_da_conta" META_ADS_ACCOUNT_NAME="Nome da conta" META_ADS_MCP_TOKEN="seu_token" npm start
```

## Estrutura

- `index.html`: página do relatório.
- `styles.css`: estilos do dashboard.
- `data.js`: base de dados do período.
- `app.js`: edição em tela, persistência local, gráficos e consumo do JSON tratado.
- `server.js`: servidor local e rota `/api/meta-ads/top-creatives` para consultar o Meta Ads sem expor token no frontend.
