/** Tours de onboarding — módulo Embarques / Pedidos de Compra */

export const EMBARQUES_LISTA_TOUR = [
  {
    target: '[data-tour="embarques-header"]',
    title: 'Visão geral dos embarques',
    body: 'Aqui você acompanha quantos embarques estão visíveis no filtro atual e o valor total em aberto. Use como painel rápido da operação.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="embarques-tabs"]',
    title: 'Embarques e Consulta',
    body: 'Alterne entre a vitrine operacional (cartões de embarque) e a consulta analítica do período. O tour da Consulta também está disponível ao mudar de aba.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="embarques-filtros"]',
    title: 'Filtros inteligentes',
    body: 'Refine por busca, status, tags, datas de emissão, ETA e recebimento. Combine filtros para focar no que precisa despachar ou receber.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="embarques-operacoes"]',
    title: 'Operações em lote',
    body: 'Importe pedidos ou NF, envie ao financeiro em lote, atualize preços e organize a lista por agrupamento ou ordenação.',
    placement: 'left',
  },
  {
    target: '[data-tour="embarques-lista"]',
    title: 'Cartões de embarque',
    body: 'Cada cartão representa um embarque (ou necessidade pendente). Toque para abrir o pedido, conferir logística e avançar o recebimento.',
    placement: 'top',
  },
  {
    target: '[data-tour="embarques-novo-pedido"]',
    title: 'Novo pedido',
    body: 'Use o botão + para iniciar um pedido de compra. Depois de salvar, os embarques são gerenciados dentro do formulário do pedido.',
    placement: 'left',
  },
];

export const CONSULTA_EMBARQUES_TOUR = [
  {
    target: '[data-tour="consulta-header"]',
    title: 'Consulta de compras',
    body: 'Resumo do período filtrado: quantidade de embarques e visão consolidada para análise, sem o foco operacional dos cartões.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="consulta-tabs"]',
    title: 'Trocar para Embarques',
    body: 'Volte à aba Embarques quando precisar agir nos cartões. A Consulta é ideal para relatórios e conferência de valores.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="consulta-filtros"]',
    title: 'Mesmos filtros, outra leitura',
    body: 'Os filtros são compartilhados com a vitrine. Ajuste período e status para montar o recorte que deseja analisar.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="consulta-relatorios"]',
    title: 'Relatórios e exportação',
    body: 'Gere relatórios PDF ou planilhas a partir do recorte atual. Útil para reuniões e fechamento com fornecedores.',
    placement: 'left',
  },
  {
    target: '[data-tour="consulta-tabela"]',
    title: 'Tabela analítica',
    body: 'Lista detalhada por embarque com valores, pendências e atalho para abrir o pedido. Agrupe por data ou transportadora conforme o organizador.',
    placement: 'top',
  },
];

export function buildPedidoCompraFormTour({ setAba }) {
  const go = (aba) => ({
    beforeStep: () => setAba(aba),
  });

  return [
    {
      target: '[data-tour="pedido-header"]',
      title: 'Cabeçalho do pedido',
      body: 'Número, status financeiro e valores do pedido. Use o menu ⋮ para pendências, logs e relatórios quando o pedido já estiver salvo.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="pedido-tabs"]',
      title: 'Abas do formulário',
      body: 'O pedido é dividido em cinco áreas: Geral, Itens, Financeiro, Logística e Recepção. O tour vai passar por cada uma.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="pedido-tab-dados-gerais"]',
      title: 'Aba Geral',
      body: 'Fornecedor, datas, tags e observações. Comece sempre definindo quem fornece e as datas previstas.',
      placement: 'top',
      ...go('dados-gerais'),
    },
    {
      target: '[data-tour="pedido-tab-itens"]',
      title: 'Aba Itens',
      body: 'Monte o pedido com produtos, quantidades e custos. É aqui que o valor total do pedido é formado.',
      placement: 'top',
      ...go('itens'),
    },
    {
      target: '[data-tour="pedido-tab-pagamento"]',
      title: 'Aba Financeiro',
      body: 'Condições de pagamento, parcelas e envio ao financeiro. Após aprovação, o pedido libera logística.',
      placement: 'top',
      ...go('pagamento'),
    },
    {
      target: '[data-tour="pedido-tab-logistica"]',
      title: 'Aba Logística',
      body: 'Informe transportadora, ETA, manifestos e embarques vinculados. É o coração do acompanhamento de chegada.',
      placement: 'top',
      ...go('logistica'),
    },
    {
      target: '[data-tour="pedido-tab-recepcao"]',
      title: 'Aba Recepção',
      body: 'Registre o recebimento físico e documental. Disponível após salvar o pedido — confira divergências aqui.',
      placement: 'top',
      ...go('recepcao'),
    },
    {
      target: '[data-tour="pedido-fab-acoes"]',
      title: 'Ações rápidas',
      body: 'Salvar, gerar PDF, anexos e envio ao financeiro ficam no botão de bússola. Use após revisar cada aba.',
      placement: 'left',
      ...go('dados-gerais'),
    },
  ];
}
