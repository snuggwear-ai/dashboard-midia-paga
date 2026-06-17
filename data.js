window.reportData = {
  meta: {
    title: "Análise & Insights",
    subtitle: "Mídia paga | Junho 01-11",
    source: "Dados atualizados da Prax em 11/06/2026",
    updatedAt: "Junho 01-11",
    role: "Designer estratégico junto ao time de mídia paga",
    summary:
      "Relatório interativo para acompanhar as principais métricas de mídia paga e comparar Junho 01-11 contra Maio 01-11."
  },
  importantMetrics: [
    { label: "Valor de conversão", key: "Valor de conversão", type: "currency", value: 102093.53, previous: 116430.66 },
    { label: "ROAS", key: "ROAS", type: "decimal", value: 7.83, previous: 9.98 },
    { label: "CPC", key: "CPC", type: "currency", value: 0.93, previous: 0.77 },
    { label: "Investimento", key: "Investimento", type: "currency", value: 13031.21, previous: 11663.45 },
    { label: "Cliques", key: "Cliques", type: "integer", value: 14058, previous: 15117 },
    { label: "CTR", key: "CTR", type: "percent", value: 1.86, previous: 2.05 },
    { label: "Custo por compra (CPA)", key: "Custo por compra", type: "currency", value: 31.83, previous: 37.89 },
    { label: "Compras", key: "Compras", type: "integer", value: 409, previous: 308 },
    { label: "% de Mídia", key: "% de Mídia", type: "percent", value: 12.76, previous: 10.02 },
    { label: "Ticket médio", key: "Ticket médio", type: "currency", value: 250.07, previous: 285.58 },
    { label: "Taxa de conversão", key: "Taxa de conversão", type: "percent", value: 2.91, previous: 2.04 }
  ],
  periodComparison: {
    currentLabel: "Junho 01-11",
    previousLabel: "Maio 01-11",
    periods: [
      { name: "Maio 01-11", investment: 11663.45, roas: 9.98, conversionValue: 116430.66 },
      { name: "Junho 01-11", investment: 13031.21, roas: 7.83, conversionValue: 102093.53 }
    ]
  },
  funnel: {
    title: "Funil de tráfego",
    subtitle: "Do alcance até a compra",
    period: "Junho 01-11",
    steps: [
      { label: "Impressões", value: 755482, color: "#4f83f1" },
      { label: "Cliques", value: 14058, color: "#456fe8", rateFromPrevious: 1.86 },
      { label: "Visualizações", value: 10465, color: "#4db3e7", rateFromPrevious: 74.44 },
      { label: "Add to Cart", value: 1659, color: "#45bed0", rateFromPrevious: 15.85 },
      { label: "Checkout", value: 642, color: "#34b9aa", rateFromPrevious: 38.7 },
      { label: "Compras", value: 429, color: "#45bf86", rateFromPrevious: 66.82 }
    ],
    insights: [
      "O maior gargalo segue entre impressões e cliques: CTR de 1,86%.",
      "Dos cliques registrados, 74,44% avançaram para visualização de produto.",
      "A passagem de visualização para carrinho ficou em 15,85%, ponto importante para investigar oferta, PDP, preço e aderência do tráfego.",
      "Checkout para compra ficou em 66,82%, indicando um fundo de funil mais forte que a entrada do tráfego."
    ]
  },
  ecommerce: {
    revenue: 107281.96,
    averageTicket: 250.07,
    visits: 21923,
    conversionRate: 1.96,
    orders: 429,
    mediaInvestment: 12635.7,
    deltas: {
      revenue: 8.89,
      averageTicket: -12.43,
      visits: -8.42,
      conversionRate: 35.78,
      orders: 24.35,
      mediaInvestment: -9.58
    }
  },
  paidMedia: {
    adsRevenue: 102093.53,
    roasGlobal: 7.83,
    mediaShare: 12.76,
    cac: 31.83,
    googleInvestment: 4649.18,
    metaInvestment: 8382.03,
    googleRoas: 9.28,
    metaRoas: 7.03,
    cpa: 31.83
  },
  channels: [
    { name: "Meta Ads", investment: 8382.03, roas: 7.03, focus: "Escala, criativos e remarketing" },
    { name: "Google Ads", investment: 4649.18, roas: 9.28, focus: "Busca, PMAX e intenção" },
    { name: "Cupons/Influenciadores", revenue: 85960.21, orders: 335, focus: "Receita com códigos de desconto" }
  ],
  influencers: [
    { name: "SORUIZ", revenue: 5866.28, orders: 17 },
    { name: "ANACAETANO", revenue: 3134.77, orders: 12 },
    { name: "VALENFINK", revenue: 1922.93, orders: 7 },
    { name: "CELINHO", revenue: 1682.69, orders: 6 },
    { name: "LUCARELLI", revenue: 1410.64, orders: 6 },
    { name: "JUAMARAL", revenue: 1163.23, orders: 3 },
    { name: "ROBERTA", revenue: 976.91, orders: 4 },
    { name: "JOAOCHZ", revenue: 941.17, orders: 3 },
    { name: "VINIQUECORRE", revenue: 927.88, orders: 3 },
    { name: "ERICK10", revenue: 857.66, orders: 3 }
  ],
  trafficImpact: [
    { name: "AQ|DIVERSAS|FEV26(ABO)", sales: 89, roas: 6.83, investment: 3451.97 },
    { name: "S|INSTITUCIONAL", sales: 62, roas: 20.88, investment: 820.88 },
    { name: "PMAX|REMARKETING", sales: 60, roas: 8.71, investment: 1491.64 },
    { name: "AQ|BERMUDAS|FEV26(CBO)", sales: 36, roas: 8.59, investment: 1252.5 },
    { name: "ADV|LINHATRAINING|FEV26(ABO)", sales: 45, roas: 7.76, investment: 1313.06 }
  ],
  optimizations: [
    { name: "S|INSTITUCIONAL", sales: 62, roas: 20.88 },
    { name: "AQ|REMARKETING|MAI26", sales: 19, roas: 11.52 },
    { name: "PMAX|REMARKETING", sales: 60, roas: 8.71 },
    { name: "AQ|BERMUDAS|FEV26(CBO)", sales: 36, roas: 8.59 },
    { name: "ADV|LINHATRAINING|FEV26(ABO)", sales: 45, roas: 7.76 }
  ],
  products: [
    { name: "Regata Slim Com Bolso Wyr", consideration: 1786, conversion: 102 },
    { name: "Camiseta Térmica Thermorun Feminina", consideration: 880, conversion: 74 },
    { name: "Shorts Alta Compressão 2 Em 1 Masculino", consideration: 803, conversion: 37 },
    { name: "Bermuda 6 Bolsos Alta Compressão Feminina", consideration: 644, conversion: 21 },
    { name: "Shorts Marathon 3 Ultraleve Eleva Feminino", consideration: 910, conversion: 25 },
    { name: "Bermuda 6 Bolsos Alta Compressão Masculina", consideration: 1239, conversion: 18 },
    { name: "Regata De Compressão 5 Bolsos Eleva", consideration: 1293, conversion: 22 },
    { name: "Bermuda Compressão 2 Bolsos Feminina", consideration: 608, conversion: 27 },
    { name: "Manguito Relógio Térmico Fpu50 Feminino", consideration: 961, conversion: 58 },
    { name: "Shorts Alta Compressão 2 Em 1 Feminino", consideration: 577, conversion: 16 },
    { name: "Top De Alta Compressão Com Bolso", consideration: 452, conversion: 18 },
    { name: "Boné 5-Panel Airpro", consideration: 469, conversion: 15 },
    { name: "Top De Alta Compressão Com Bolso Fem", consideration: 119, conversion: 12 },
    { name: "Bermuda Compressão 2 Bolsos Masculina", consideration: 277, conversion: 12 },
    { name: "Shorts Marathon 3 Ultraleve Eleva Masculino", consideration: 410, conversion: 10 }
  ],
  considerations: {
    performance:
      "De 01 a 11 de junho, a receita ecommerce cresceu 8,89% versus 01 a 11 de maio, com 429 pedidos pagos (+24,35%) e queda no ticket médio (-12,43%). Em mídia paga, o Google sustentou o maior ROAS (9,28x), enquanto Meta concentrou 64,3% do investimento.",
    influencers:
      "Os códigos de desconto somaram R$85.960,21 em receita e 335 pedidos no período. Entre códigos com perfil de influenciador, SORUIZ lidera com R$5.866,28 e 17 pedidos, seguido por ANACAETANO e VALENFINK.",
    sentiment:
      "No recorte de 01 a 11 de junho, o investimento de mídia paga cresceu 11,73% contra maio e o valor de conversão caiu 12,31%, pressionando o ROAS para 7,83x. Ainda assim, as compras atribuídas subiram 32,99% e a taxa de conversão por clique avançou para 2,91%, sugerindo maior eficiência no fundo de funil com ticket médio menor.",
    crisisPlan:
      "Reequilibrar orçamento para campanhas com ROAS acima da média, revisar criativos de menor CTR e acompanhar ticket médio por produto/cupom antes de ampliar investimento.",
    products:
      "Produtos campeões no período: Regata Slim com Bolso Wyr, Camiseta Térmica Thermorun Feminina e Shorts Alta Compressão 2 em 1 Masculino. Priorizar criativos e estoque desses itens, enquanto produtos com visitas altas e conversão menor merecem teste de oferta e PDP.",
    funnel:
      "Entrada com CTR de 1,86% e boa passagem de clique para visualização (74,44%). O ponto mais sensível está em visualização para carrinho (15,85%), enquanto carrinho para checkout (38,70%) e checkout para compra (66,82%) indicam fundo de funil relativamente forte."
  }
};
