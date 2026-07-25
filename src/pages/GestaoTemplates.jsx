import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Star, StarOff, Copy, FileText, Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const TIPOS = [
  { value: 'venda_80mm', label: 'Comprovante de Venda 80mm' },
  { value: 'venda_a4', label: 'Comprovante de Venda A4' },
  { value: 'orcamento_80mm', label: 'Orçamento 80mm' },
  { value: 'orcamento_a4', label: 'Orçamento A4' },
  { value: 'recibo_entrega', label: 'Recibo de Entrega' },
  { value: 'recibo_movimento_caixa', label: 'Recibo de Movimento de Caixa' },
  { value: 'recibo_despesa', label: 'Recibo de Despesa' },
];

function TemplateCard({ template, onEdit, onDelete, onSetDefault, onDuplicate }) {
  const tipoLabel = TIPOS.find(t => t.value === template.tipo)?.label || template.tipo;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm truncate">{template.nome}</span>
            {template.is_default && (
              <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Padrão</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{tipoLabel}</div>
          {template.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.descricao}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => onEdit(template)} className="h-8 text-xs gap-1 rounded-xl">
          <FileText className="w-3.5 h-3.5" /> Editar HTML
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDuplicate(template)} className="h-8 text-xs gap-1 rounded-xl text-muted-foreground">
          <Copy className="w-3.5 h-3.5" />
        </Button>
        {!template.is_default && (
          <Button size="sm" variant="ghost" onClick={() => onSetDefault(template)} className="h-8 text-xs gap-1 rounded-xl text-muted-foreground" title="Definir como padrão">
            <Star className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDelete(template)} className="h-8 text-xs text-red-400 hover:text-red-600 rounded-xl ml-auto">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onCancel }) {
  const [nome, setNome] = useState(template?.nome || '');
  const [tipo, setTipo] = useState(template?.tipo || 'venda_80mm');
  const [descricao, setDescricao] = useState(template?.descricao || '');
  const [htmlTemplate, setHtmlTemplate] = useState(template?.html_template || '');
  const [saving, setSaving] = useState(false);
  const [showRef, setShowRef] = useState(false);

  const handleSave = async () => {
    if (!nome.trim() || !htmlTemplate.trim()) {
      toast.error('Nome e HTML são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const data = { nome, tipo, descricao, html_template: htmlTemplate };
      if (template?.id) {
        await base44.entities.ComprovanteTemplate.update(template.id, data);
        toast.success('Template atualizado!');
      } else {
        await base44.entities.ComprovanteTemplate.create({ ...data, is_default: false });
        toast.success('Template criado!');
      }
      onSave();
    } catch {
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">
          {template?.id ? 'Editar Template' : 'Novo Template'}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs rounded-xl">Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1 rounded-xl">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-shrink-0">
        <Input
          placeholder="Nome do template"
          value={nome}
          onChange={e => setNome(e.target.value)}
          className="h-9 text-sm rounded-xl"
        />
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          className="h-9 text-sm border border-border/40 rounded-xl px-3 bg-card text-foreground"
        >
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <Input
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        className="h-9 text-sm rounded-xl flex-shrink-0"
      />

      {/* Referência de tags */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setShowRef(!showRef)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/90 dark:hover:text-muted-foreground"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRef ? 'rotate-180' : ''}`} />
          {showRef ? 'Ocultar' : 'Ver'} dicionário de tags disponíveis
        </button>
        {showRef && <TagReference tipo={tipo} />}
      </div>

      <textarea
        value={htmlTemplate}
        onChange={e => setHtmlTemplate(e.target.value)}
        className="flex-1 w-full min-h-[400px] font-mono text-xs border border-border/40 rounded-xl p-3 bg-muted/40 dark:bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Cole aqui o HTML do template..."
        spellCheck={false}
      />
    </div>
  );
}

function TagReference({ tipo }) {
  const tags = getTagsForTipo(tipo);
  return (
    <div className="mt-2 bg-muted/40 dark:bg-background rounded-xl p-3 text-xs space-y-3 border border-border/40">
      {tags.map(grupo => (
        <div key={grupo.grupo}>
          <div className="font-semibold text-muted-foreground mb-1">{grupo.grupo}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {grupo.tags.map(tag => (
              <div key={tag.tag} className="flex flex-col">
                <code className="text-blue-600 dark:text-blue-400 font-mono">{tag.tag}</code>
                <span className="text-muted-foreground text-[10px]">{tag.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-border/40 pt-2">
        <div className="font-semibold text-muted-foreground mb-1">Sintaxe de Loop e Condicionais</div>
        <div className="space-y-1 text-muted-foreground">
          <div><code className="text-purple-600 dark:text-purple-400">{'{{#itens}}...{{/itens}}'}</code> → repete para cada item</div>
          <div><code className="text-purple-600 dark:text-purple-400">{'{{#tem_desconto}}...{{/tem_desconto}}'}</code> → só mostra se houver desconto</div>
          <div><code className="text-purple-600 dark:text-purple-400">{'{{^tem_cliente}}...{{/tem_cliente}}'}</code> → só mostra se NÃO houver cliente</div>
        </div>
      </div>
    </div>
  );
}

function getTagsForTipo(tipo) {
  const empresa = {
    grupo: 'Empresa',
    tags: [
      { tag: '{{empresa_nome}}', desc: 'Razão social' },
      { tag: '{{empresa_cnpj}}', desc: 'CNPJ' },
      { tag: '{{empresa_telefone}}', desc: 'Telefone' },
      { tag: '{{empresa_endereco}}', desc: 'Endereço' },
      { tag: '{{empresa_cidade}}', desc: 'Cidade' },
      { tag: '{{empresa_estado}}', desc: 'UF' },
      { tag: '{{empresa_rodape}}', desc: 'Mensagem rodapé' },
    ]
  };

  if (tipo?.startsWith('venda')) return [
    empresa,
    { grupo: 'Pedido', tags: [
      { tag: '{{numero}}', desc: 'Nº do pedido' },
      { tag: '{{data}}', desc: 'Data/hora' },
      { tag: '{{cliente}}', desc: 'Nome do cliente' },
      { tag: '{{vendedor}}', desc: 'Nome do vendedor' },
      { tag: '{{caixa}}', desc: 'Operador de caixa' },
      { tag: '{{status}}', desc: 'Status do pedido' },
      { tag: '{{observacoes}}', desc: 'Observações' },
    ]},
    { grupo: 'Valores', tags: [
      { tag: '{{subtotal}}', desc: 'Subtotal (R$)' },
      { tag: '{{desconto}}', desc: 'Desconto (R$)' },
      { tag: '{{frete}}', desc: 'Frete (R$)' },
      { tag: '{{total}}', desc: 'Total (R$)' },
    ]},
    { grupo: 'Loop {{#itens}}', tags: [
      { tag: '{{num}}', desc: 'Nº do item' },
      { tag: '{{nome}}', desc: 'Nome do produto' },
      { tag: '{{quantidade}}', desc: 'Qtd' },
      { tag: '{{preco_unitario}}', desc: 'Preço unit.' },
      { tag: '{{total}}', desc: 'Total do item' },
    ]},
    { grupo: 'Loop {{#pagamentos}}', tags: [
      { tag: '{{forma}}', desc: 'Forma de pagamento' },
      { tag: '{{parcelas}}', desc: 'Parcelas (ex: 3x)' },
      { tag: '{{valor}}', desc: 'Valor pago' },
    ]},
  ];

  if (tipo?.startsWith('orcamento')) return [
    empresa,
    { grupo: 'Orçamento', tags: [
      { tag: '{{data}}', desc: 'Data/hora' },
      { tag: '{{cliente}}', desc: 'Nome do cliente' },
      { tag: '{{tabela}}', desc: 'Tabela de preço' },
      { tag: '{{observacoes}}', desc: 'Observações' },
      { tag: '{{subtotal}}', desc: 'Subtotal' },
      { tag: '{{desconto}}', desc: 'Desconto' },
      { tag: '{{total}}', desc: 'Total' },
      { tag: '{{total_itens}}', desc: 'Total de itens' },
    ]},
    { grupo: 'Loop {{#itens}}', tags: [
      { tag: '{{num}}', desc: 'Nº' },
      { tag: '{{nome}}', desc: 'Produto' },
      { tag: '{{quantidade}}', desc: 'Qtd' },
      { tag: '{{unidade}}', desc: 'Unidade' },
      { tag: '{{preco_unitario}}', desc: 'Preço unit.' },
      { tag: '{{total}}', desc: 'Total' },
    ]},
  ];

  if (tipo === 'recibo_entrega') return [
    empresa,
    { grupo: 'Entrega', tags: [
      { tag: '{{numero}}', desc: 'Nº do pedido' },
      { tag: '{{data_entrega}}', desc: 'Data da entrega' },
      { tag: '{{tipo_entrega}}', desc: 'Retirada / Delivery' },
      { tag: '{{cliente}}', desc: 'Nome do cliente' },
      { tag: '{{recebedor}}', desc: 'Quem recebeu' },
      { tag: '{{documento_recebedor}}', desc: 'CPF/RG do recebedor' },
      { tag: '{{responsavel}}', desc: 'Responsável pela entrega' },
      { tag: '{{total}}', desc: 'Valor total' },
      { tag: '{{observacoes}}', desc: 'Observações' },
    ]},
    { grupo: 'Loop {{#itens}}', tags: [
      { tag: '{{num}}', desc: 'Nº' },
      { tag: '{{nome}}', desc: 'Produto' },
      { tag: '{{quantidade}}', desc: 'Qtd' },
      { tag: '{{unidade}}', desc: 'UN' },
    ]},
  ];

  return [empresa];
}

export default function GestaoTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null); // null = lista, objeto = editor
  const [filtroTipo, setFiltroTipo] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ComprovanteTemplate.list('-created_date', 200);
      setTemplates(data);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const handleDelete = async (template) => {
    if (!confirm(`Excluir o template "${template.nome}"?`)) return;
    try {
      await base44.entities.ComprovanteTemplate.delete(template.id);
      toast.success('Template excluído');
      carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      // Remove default dos outros do mesmo tipo
      const mesmoTipo = templates.filter(t => t.tipo === template.tipo && t.is_default && t.id !== template.id);
      await Promise.all(mesmoTipo.map(t => base44.entities.ComprovanteTemplate.update(t.id, { is_default: false })));
      await base44.entities.ComprovanteTemplate.update(template.id, { is_default: true });
      toast.success('Template definido como padrão');
      carregar();
    } catch {
      toast.error('Erro ao definir padrão');
    }
  };

  const handleDuplicate = async (template) => {
    try {
      await base44.entities.ComprovanteTemplate.create({
        nome: `${template.nome} (Cópia)`,
        tipo: template.tipo,
        descricao: template.descricao,
        html_template: template.html_template,
        is_default: false,
      });
      toast.success('Template duplicado');
      carregar();
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  const templatesFiltrados = filtroTipo
    ? templates.filter(t => t.tipo === filtroTipo)
    : templates;

  if (editando !== null) {
    return (
      <div className="p-4 md:p-6 h-[calc(100vh-120px)] flex flex-col">
        <TemplateEditor
          template={editando === 'novo' ? null : editando}
          onSave={() => { setEditando(null); carregar(); }}
          onCancel={() => setEditando(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground font-glacial">Templates de Impressão</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Edite o HTML dos documentos imprimíveis sem tocar no código do sistema</p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditando('novo')}
          className="h-9 text-xs gap-1.5 rounded-xl bg-background hover:bg-primary dark:bg-muted dark:text-foreground"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Template
        </Button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroTipo('')}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${!filtroTipo ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90'}`}
        >
          Todos ({templates.length})
        </button>
        {TIPOS.map(t => {
          const count = templates.filter(tp => tp.tipo === t.value).length;
          if (count === 0) return null;
          return (
            <button
              key={t.value}
              onClick={() => setFiltroTipo(t.value)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${filtroTipo === t.value ? 'bg-primary text-primary-foreground dark:bg-muted dark:text-foreground' : 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90'}`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : templatesFiltrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum template encontrado.<br />
          <button onClick={() => setEditando('novo')} className="underline mt-2 text-muted-foreground">Criar o primeiro</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templatesFiltrados.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={setEditando}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}