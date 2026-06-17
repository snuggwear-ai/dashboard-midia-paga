# Site de análise de mídia paga

Este site foi montado a partir do PDF `Cópia de MAIO Final - Análise & Insghts.pdf`.

## Como atualizar os dados

- Edite qualquer número ou texto direto na página usando o botão `Editar`.
- Use `Exportar` para baixar a base em JSON.
- Use `Importar` para carregar uma base JSON no mesmo formato.
- Quando houver um novo PDF, CSV ou planilha, os dados principais podem ser substituídos no arquivo `data.js`.

## Top 5 Criativos do Mês

A seção `Top 5 Criativos do Mês` consulta o Meta Ads pelo servidor local, sem expor token no navegador.

```bash
cd site
META_ADS_MCP_TOKEN="seu_token" npm start
```

Por padrão, a rota usa a conta `Snugg NOVA` (`4437833576442216`). Para trocar a conta:

```bash
META_ADS_ACCOUNT_ID="id_da_conta" META_ADS_ACCOUNT_NAME="Nome da conta" META_ADS_MCP_TOKEN="seu_token" npm start
```

## Estrutura

- `index.html`: página do relatório.
- `styles.css`: visual inspirado em interfaces limpas e premium.
- `data.js`: base de dados do período.
- `app.js`: edição em tela, persistência local e gráficos.
- `server.js`: servidor local e rota tratada para os criativos do Meta Ads.
