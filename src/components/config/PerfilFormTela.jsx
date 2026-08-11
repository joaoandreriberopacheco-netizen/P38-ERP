import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Shield, Eye, Pencil, ChevronDown, ChevronRight, Home } from 'lucide-react';

import {
  Monitor, LayoutDashboard, TrendingUp, Package,
  DollarSign, BookOpen, Settings, ClipboardPenLine
} from 'lucide-react';

const MODULO_ICONS = {
  homepage: Home,
  pdv: Monitor,
  dashboard: LayoutDashboard,
  vendas: TrendingUp,
  estoque: Package,
  financeiro: DollarSign,
  relatorios: BookOpen,
  consumo_interno: ClipboardPenLine,
  configuracoes: Settings,
};

export const MODULOS = [
  {
    key: 'homepage', label: 'Página Inicial',
    submodulos: [
      { key: 'resumo_vendas_home', label: 'Resumo de Vendas' },
      { key: 'kpis_home', label: 'KPIs Rápidos' },
      { key: 'avisos_home', label: 'Avisos e Alertas' },
      { key: 'atalhos_personalizados', label: 'Atalhos Personalizados' },
      { key: 'acoes_rapidas', label: 'Ações Rápidas (PDV, Caixa...)' },
    ]
  },
  {
    key: 'pdv', label: 'PDV',
    submodulos: [
      { key: 'acesso_vendedor', label: 'Interface de Vendedor' },
      { key: 'acesso_caixa', label: 'Interface de Caixa' },
      { key: 'acesso_supermercado', label: 'Modo Supermercado' },
      { key: 'acesso_auto_atendimento', label: 'Auto-atendimento' },
      { key: 'aplicar_desconto', label: 'Aplicar Desconto' },
      { key: 'cancelar_item_venda', label: 'Cancelar Item' },
      { key: 'cancelar_venda', label: 'Cancelar Venda' },
      { key: 'ver_historico_vendas', label: 'Ver Histórico' },
    ]
  },
  {
    key: 'dashboard', label: 'Dashboard',
    submodulos: [
      { key: 'acesso', label: 'Acesso ao Dashboard' },
      { key: 'ver_kpis_vendas', label: 'KPIs de Vendas' },
      { key: 'ver_kpis_financeiro', label: 'KPIs Financeiros' },
      { key: 'ver_kpis_estoque', label: 'KPIs de Estoque' },
    ]
  },
  {
    key: 'vendas', label: 'Vendas',
    submodulos: [
      { key: 'acesso', label: 'Módulo de Vendas' },
      { key: 'listar_pedidos', label: 'Listar Pedidos' },
      { key: 'cancelar_pedido', label: 'Cancelar Pedido' },
      { key: 'controle_entregas', label: 'Controle de Entregas' },
      { key: 'painel_gerencial', label: 'Painel Gerencial' },
      { key: 'vendas_perdidas', label: 'Vendas Perdidas' },
    ]
  },
  {
    key: 'estoque', label: 'Estoque',
    submodulos: [
      { key: 'visualizar_produtos', label: 'Produtos' },
      { key: 'ver_custo_compra', label: 'Ver Custo de Compra' },
      { key: 'realizar_ajuste_estoque', label: 'Ajuste de Estoque' },
      { key: 'separacao_pedidos', label: 'Separação de Pedidos' },
      { key: 'conferencia_estoque', label: 'Conferência' },
      { key: 'auditoria_estoque', label: 'Auditoria' },
      { key: 'contagem_express', label: 'Contagem Express' },
      {
        key: 'compras_ativo',
        label: 'Exibir grupo Compras',
      },
      {
        key: 'compras',
        label: 'Compras',
        submodulos: [
          { key: 'sugestoes', label: 'SMART SUPPLY' },
          { key: 'cotacoes', label: 'Cotações' },
          { key: 'pedidos', label: 'Pedidos de Compra' },
          { key: 'conferencia', label: 'Conferência de Entrada' },
          { key: 'logistica', label: 'Logística / Itinerário (Boats)', deprecated: true }
        ]
      },
      { key: 'armazenagem', label: 'Armazenagem' },
      { key: 'tabela_precos', label: 'Tabela de Preços (Consulta)' },
      { key: 'gerar_orcamento', label: 'Gerar Orçamento na Tabela de Preços' },
    ]
  },
  {
    key: 'financeiro', label: 'Financeiro',
    submodulos: [
      { key: 'acesso', label: 'Módulo Financeiro' },
      { key: 'contas', label: 'Contas e Saldos' },
      { key: 'criar_lancamento', label: 'Criar Lançamento' },
      { key: 'aprovar_pagamentos', label: 'Aprovar Pagamentos' },
      { key: 'conciliar_movimentos', label: 'Conciliação Bancária' },
      { key: 'ver_extrato', label: 'Ver Extrato' },
      { key: 'caixas_ativos', label: 'Caixas Ativos' },
    ]
  },
  {
    key: 'relatorios', label: 'Relatórios',
    submodulos: [
      { key: 'acesso', label: 'Acesso a Relatórios' },
      { key: 'relatorio_vendas', label: 'Relatório de Vendas' },
      { key: 'relatorio_estoque', label: 'Relatório de Estoque' },
      { key: 'relatorio_financeiro', label: 'Relatório Financeiro' },
      { key: 'relatorio_margem', label: 'Relatório de Margem' },
    ]
  },
  {
    key: 'consumo_interno', label: 'Consumo Interno',
    submodulos: [
      { key: 'acesso', label: 'Acesso ao módulo' },
      { key: 'registrar', label: 'Registrar consumo interno' },
      { key: 'visualizar_historico', label: 'Visualizar histórico' },
      { key: 'anexos_assinatura', label: 'Anexos e assinatura' },
    ]
  },
  {
    key: 'configuracoes', label: 'Configurações',
    submodulos: [
      { key: 'acesso', label: 'Acesso às Configurações' },
      { key: 'gerenciar_usuarios', label: 'Gerenciar Usuários' },
      { key: 'gerenciar_perfis', label: 'Gerenciar Perfis de Acesso' },
      { key: 'gerenciar_formas_pagamento', label: 'Formas de Pagamento' },
      { key: 'dados_empresa', label: 'Dados da Empresa' },
      { key: 'parametros_gerais', label: 'Parâmetros Gerais' },
    ]
  },
];

// ─── Contar permissões recursivamente ────────────────────────────
export function contarPermissoes(permissoes, moduloKey) {
  let ativas = 0, total = 0;
  const modulo = MODULOS.find(m => m.key === moduloKey);
  if (!modulo) return { ativas: 0, total: 0 };

  function contarRecursivo(submodulos, contexto) {
    submodulos.forEach(sub => {
      if (sub.deprecated) return;
      total += 1;
      const val = contexto?.[sub.key];
      if (val === true) ativas++;
      if (sub.submodulos) {
        contarRecursivo(sub.submodulos, typeof val === 'object' ? val : {});
      }
    });
  }

  contarRecursivo(modulo.submodulos || [], permissoes?.[moduloKey] || {});
  return { ativas, total };
}

// ─── Utilitário: atualiza valor em caminho aninhado ──────────────
function setDeepValue(obj, path, value) {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return { ...obj, [head]: value };
  }
  return {
    ...obj,
    [head]: setDeepValue(typeof obj[head] === 'object' && obj[head] !== null ? obj[head] : {}, rest, value),
  };
}

function getValueByPath(permissoes, moduloKey, caminhoCompleto) {
  let valor = permissoes?.[moduloKey];
  for (const k of caminhoCompleto) {
    valor = valor?.[k];
  }
  return valor;
}

function TreePermissionRow({ item, moduloKey, caminho = [], permissoes, onChange, nivel = 0, expandedMap, onToggleExpand }) {
  if (item.deprecated) return null;
  const temSubitens = item.submodulos && item.submodulos.filter((s) => !s.deprecated).length > 0;
  const caminhoCompleto = [...caminho, item.key];
  const valor = getValueByPath(permissoes, moduloKey, caminhoCompleto);
  const checked = valor === true;
  const expandKey = `${moduloKey}.${caminhoCompleto.join('.')}`;
  const isExpanded = expandedMap[expandKey] ?? nivel < 1;
  const childPerms = typeof valor === 'object' && valor !== null ? valor : {};
  const childCount = temSubitens ? contarPermissoes({ [item.key]: childPerms }, item.key) : { ativas: 0, total: 0 };

  return (
    <div className="space-y-1">
      <div
        className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/20"
        style={{ paddingLeft: `${12 + nivel * 18}px` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {temSubitens ? (
            <button
              type="button"
              onClick={() => onToggleExpand(expandKey)}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-muted dark:bg-muted dark:text-muted-foreground dark:hover:bg-primary/90"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="w-7 flex-none" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground/90">{item.label}</span>
              {temSubitens && (
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${
                  childCount.ativas > 0 ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                }`}>
                  {childCount.ativas}/{childCount.total}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex h-10 w-14 flex-none items-center justify-end">
          <Switch
            checked={checked}
            onCheckedChange={v => {
              const novoModulo = setDeepValue(permissoes?.[moduloKey] || {}, caminhoCompleto, v);
              onChange({ ...permissoes, [moduloKey]: novoModulo });
            }}
            className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-muted"
          />
        </div>
      </div>

      {temSubitens && isExpanded && (
        <div className="space-y-1 border-l border-border/40/80 pl-1 dark:border-border/40/80">
          {item.submodulos.filter((s) => !s.deprecated).map((sub) => (
            <TreePermissionRow
              key={sub.key}
              item={sub}
              moduloKey={moduloKey}
              caminho={caminhoCompleto}
              permissoes={permissoes}
              onChange={onChange}
              nivel={nivel + 1}
              expandedMap={expandedMap}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuloCard({ modulo, permissoes, onChange }) {
  const [expandido, setExpandido] = useState(false);
  const [expandedMap, setExpandedMap] = useState({});
  const { ativas, total } = contarPermissoes(permissoes, modulo.key);
  const Icon = MODULO_ICONS[modulo.key] || Shield;

  const toggleExpand = (key) => {
    setExpandedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm dark:bg-muted">
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-muted/30"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">{modulo.label}</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${
            ativas > 0 ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
          }`}>
            {ativas}/{total}
          </span>
        </div>
        {expandido ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expandido && (
        <div className="border-t border-border/40 px-2 pb-3 pt-2 dark:border-border/40">
          {modulo.submodulos?.filter((s) => !s.deprecated).map((item) => (
            <TreePermissionRow
              key={item.key}
              item={item}
              moduloKey={modulo.key}
              caminho={[]}
              permissoes={permissoes}
              onChange={onChange}
              nivel={0}
              expandedMap={expandedMap}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tela completa de edição de perfil ──────────────────────────
export default function PerfilFormTela({ perfil, onSalvar, onCancelar }) {
  const VAZIO = { nome: '', descricao: '', menu_compacto: false, ativo: true, permissoes: {} };
  const base = perfil ? { ...VAZIO, ...perfil } : VAZIO;
  const [form, setForm] = useState({ ...base, permissoes: base.permissoes || {} });

  const handleSalvar = () => {
    if (!form.nome.trim()) return;
    onSalvar({ ...form });
  };

  const totalAtivas = MODULOS.reduce((acc, m) => acc + contarPermissoes(form.permissoes, m.key).ativas, 0);
  const totalGeral = MODULOS.reduce((acc, m) => acc + contarPermissoes(form.permissoes, m.key).total, 0);

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancelar}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {perfil ? `Editar: ${perfil.nome}` : 'Novo Perfil de Acesso'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalAtivas}/{totalGeral} permissões ativas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancelar} className="h-8 text-xs text-muted-foreground">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!form.nome.trim()}
            className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-muted dark:text-foreground"
          >
            {perfil ? 'Salvar Alterações' : 'Criar Perfil'}
          </Button>
        </div>
      </div>

      {/* Corpo — 2 colunas em desktop */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* Coluna esquerda: dados básicos */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Nome do Perfil *</Label>
            <Input
              placeholder="Ex: Operador de Caixa..."
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              className="bg-muted/50 border-0 shadow-sm dark:text-white text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
            <Input
              placeholder="Responsabilidades..."
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
              className="bg-muted/50 border-0 shadow-sm dark:text-white text-sm h-9"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl shadow-sm">
            <div>
              <p className="text-sm text-foreground">Menu Compacto</p>
              <p className="text-xs text-muted-foreground">Interface simplificada</p>
            </div>
            <Switch
              checked={form.menu_compacto}
              onCheckedChange={v => setForm({ ...form, menu_compacto: v })}
              className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-muted"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl shadow-sm">
            <div>
              <p className="text-sm text-foreground">Perfil Ativo</p>
              <p className="text-xs text-muted-foreground">Disponível para atribuição</p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={v => setForm({ ...form, ativo: v })}
              className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-muted"
            />
          </div>

          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">Legenda de permissões</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded bg-primary dark:bg-muted flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-foreground" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span>Ativo</span>
              <div className="w-4 h-4 rounded border border-border/40 dark:border-border/40 bg-card dark:bg-muted ml-2" />
              <span>Inativo</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Eye className="w-3.5 h-3.5" />
              <span>= Pode visualizar</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Pencil className="w-3.5 h-3.5" />
              <span>= Pode editar / operar</span>
            </div>
          </div>
        </div>

        {/* Coluna direita: permissões */}
        <div className="space-y-2">
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground">PERMISSÕES POR MÓDULO</p>
          {MODULOS.map(modulo => (
            <ModuloCard
              key={modulo.key}
              modulo={modulo}
              permissoes={form.permissoes}
              onChange={novas => setForm({ ...form, permissoes: novas })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}