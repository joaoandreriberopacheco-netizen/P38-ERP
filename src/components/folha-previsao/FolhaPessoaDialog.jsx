import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { P38HelpPopover } from '@/components/ui/p38-help-popover';
import FolhaCentroCustoSelect from '@/components/folha-previsao/FolhaCentroCustoSelect';
import {
  FOLHA_DIA_VENCIMENTO,
  RETIRADA_FREQUENCIA_LABELS,
  SITUACAO_FOLHA,
  TIPO_VINCULO,
  TIPO_VINCULO_LABELS,
  aplicarSalarioBaseNasRubricas,
  criarModeloComDefaults,
  criarRubricasPadrao,
  extrairSalarioBase,
  formatDataBr,
  gerarIdInterno,
} from '@/lib/folhaPrevisaoCalculos';

function LabelComAjuda({ label, ajudaLabel, children }) {
  return (
    <div className="flex items-center gap-1">
      <Label>{label}</Label>
      <P38HelpPopover label={ajudaLabel} side="top" align="start" size="sm">
        {children}
      </P38HelpPopover>
    </div>
  );
}

function FeriasRow({ ferias, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-[120px_1fr_100px_32px] gap-2 items-end">
      <div>
        <Label className="text-xs">Mês (AAAA-MM)</Label>
        <Input
          value={ferias.competencia_prevista || ''}
          onChange={(e) => onChange({ ...ferias, competencia_prevista: e.target.value })}
          placeholder="2026-07"
          className="h-9"
        />
      </div>
      <div>
        <Label className="text-xs">Descrição</Label>
        <Input
          value={ferias.descricao || ''}
          onChange={(e) => onChange({ ...ferias, descricao: e.target.value })}
          placeholder="Férias julho"
          className="h-9"
        />
      </div>
      <div>
        <Label className="text-xs">Valor</Label>
        <Input
          type="number"
          step="0.01"
          value={ferias.valor_previsto ?? 0}
          onChange={(e) => onChange({ ...ferias, valor_previsto: parseFloat(e.target.value) || 0 })}
          className="h-9"
        />
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

export default function FolhaPessoaDialog({
  open,
  onClose,
  cadastro,
  colaboradoresDisponiveis = [],
  centrosCustoRegistros = [],
  /** @deprecated use centrosCustoRegistros */
  centrosCustoRegistrados = [],
  onCentrosCustoChange,
  onSave,
  onDesligar,
  onReativar,
  saving,
}) {
  const [form, setForm] = useState(criarModeloComDefaults());
  const [modoPessoa, setModoPessoa] = useState('existente');
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [salarioBase, setSalarioBase] = useState(0);
  const [avancadoAberto, setAvancadoAberto] = useState(false);

  const editando = Boolean(cadastro?.id);
  const desligado = form.situacao === SITUACAO_FOLHA.DESLIGADO;
  const ehSocio = form.tipo_vinculo === TIPO_VINCULO.SOCIO;

  const centrosParaSelect = useMemo(() => {
    if (centrosCustoRegistros?.length) return centrosCustoRegistros;
    return (centrosCustoRegistrados || []).map((nome, idx) => ({
      id: '',
      nome: typeof nome === 'string' ? nome : nome?.nome || '',
      ativo: true,
      ordem: idx,
    })).filter((c) => c.nome);
  }, [centrosCustoRegistros, centrosCustoRegistrados]);

  useEffect(() => {
    if (!open) return;
    if (cadastro) {
      setForm({
        ...criarModeloComDefaults(),
        ...cadastro,
        rubricas: cadastro.rubricas?.length ? cadastro.rubricas : criarRubricasPadrao(cadastro.tipo_vinculo),
        ferias_programadas: cadastro.ferias_programadas || [],
      });
      setModoPessoa('existente');
      setSalarioBase(extrairSalarioBase(cadastro));
      setNovoNome('');
      setNovoEmail('');
    } else {
      setForm(criarModeloComDefaults());
      setModoPessoa(colaboradoresDisponiveis.length ? 'existente' : 'nova');
      setSalarioBase(0);
      setNovoNome('');
      setNovoEmail('');
    }
    setAvancadoAberto(false);
  }, [cadastro, open, colaboradoresDisponiveis.length]);

  const handleTipoVinculo = (tipo) => {
    setForm((prev) =>
      criarModeloComDefaults({
        ...prev,
        tipo_vinculo: tipo,
        rubricas: criarRubricasPadrao(tipo),
        decimo_terceiro_ativo: tipo === TIPO_VINCULO.SOCIO ? false : true,
      }),
    );
    setSalarioBase(0);
  };

  const handleSave = () => {
    const rubricas = aplicarSalarioBaseNasRubricas(form.rubricas, salarioBase, form.tipo_vinculo);
    onSave({
      ...form,
      rubricas,
      _modoPessoa: editando ? 'existente' : modoPessoa,
      _novoColaborador:
        !editando && modoPessoa === 'nova'
          ? { nome: novoNome.trim(), email: novoEmail.trim() }
          : null,
    });
  };

  const podeSalvar =
    (editando && form.colaborador_id && String(form.colaborador_nome || form.nome || '').trim()) ||
    (modoPessoa === 'existente' && form.colaborador_id) ||
    (modoPessoa === 'nova' && novoNome.trim());

  const updateFerias = (idx, f) => {
    const ferias_programadas = [...(form.ferias_programadas || [])];
    ferias_programadas[idx] = f;
    setForm({ ...form, ferias_programadas });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <DialogTitle>{editando ? 'Editar pessoa' : 'Cadastrar na folha'}</DialogTitle>
            <P38HelpPopover label="Ajuda: cadastro na folha" side="bottom" align="start" size="sm">
              <p className="font-medium text-foreground">Cadastro único</p>
              <p className="text-muted-foreground">
                Cadastre a pessoa uma vez — ela entra automaticamente na programação e na projeção de caixa.
              </p>
              <p className="text-muted-foreground">
                Pagamento dia {FOLHA_DIA_VENCIMENTO} do mês seguinte; folha fecha no último dia do mês.
              </p>
            </P38HelpPopover>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {desligado && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-300">
              Saiu em {formatDataBr(form.data_desligamento)}.
              {onReativar && (
                <Button
                  variant="link"
                  className="h-auto p-0 ml-2 text-red-800 dark:text-red-300"
                  onClick={() => onReativar(cadastro)}
                >
                  Reativar
                </Button>
              )}
            </div>
          )}

          <div>
            <Label>É funcionário ou sócio?</Label>
            <Select
              value={form.tipo_vinculo || TIPO_VINCULO.FUNCIONARIO}
              onValueChange={handleTipoVinculo}
              disabled={desligado}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_VINCULO_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editando ? (
            <div>
              <Label>Nome</Label>
              <Input
                className="mt-1.5"
                value={form.colaborador_nome || form.nome || ''}
                onChange={(e) => {
                  const nome = e.target.value;
                  setForm({ ...form, colaborador_nome: nome, nome });
                }}
                placeholder="Nome da pessoa"
                disabled={desligado}
              />
            </div>
          ) : (
            <>
              {colaboradoresDisponiveis.length > 0 && (
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={modoPessoa}
                    onValueChange={setModoPessoa}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existente">Pessoa já cadastrada</SelectItem>
                      <SelectItem value="nova">Nova pessoa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {modoPessoa === 'existente' ? (
                <div>
                  <Label>Pessoa</Label>
                  <Select
                    value={form.colaborador_id || '__none__'}
                    onValueChange={(v) => {
                      const col = colaboradoresDisponiveis.find((c) => c.id === v);
                      setForm({
                        ...form,
                        colaborador_id: v === '__none__' ? '' : v,
                        colaborador_nome: col?.nome || '',
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Escolha…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione…</SelectItem>
                      {colaboradoresDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      className="mt-1.5"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      placeholder="Ex: Maria Silva"
                    />
                  </div>
                  <div>
                    <LabelComAjuda label="E-mail" ajudaLabel="Ajuda: e-mail">
                      <p className="text-muted-foreground">Opcional. Usado apenas para cadastro no sistema.</p>
                    </LabelComAjuda>
                    <Input
                      className="mt-1.5"
                      type="email"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="rounded-lg ring-1 ring-border/40 p-3 space-y-3">
            <Label className="font-medium">Classificação de custo</Label>
            <div>
              <LabelComAjuda label="Centro de custo" ajudaLabel="Ajuda: centro de custo">
                <p className="text-muted-foreground">
                  Cadastro partilhado (tabela FolhaCentroCusto), igual às categorias financeiras.
                </p>
                <p className="text-muted-foreground">
                  Use o botão <strong className="text-foreground">+</strong> no seletor para criar um centro novo.
                </p>
              </LabelComAjuda>
              <div className="mt-1.5">
                <FolhaCentroCustoSelect
                  centros={centrosParaSelect}
                  value={form.centro_custo || ''}
                  valueId={form.centro_custo_id || ''}
                  disabled={desligado}
                  onValueChange={(centro) =>
                    setForm({
                      ...form,
                      centro_custo: centro?.nome || '',
                      centro_custo_id: centro?.id || '',
                    })
                  }
                  onCentrosChange={onCentrosCustoChange}
                  placeholder="Escolher centro de custo"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
                <Checkbox
                  id="custo-direto"
                  checked={
                    typeof form.custo_direto === 'boolean'
                      ? form.custo_direto
                      : form.classificacao_despesa !== 'indireta'
                  }
                  onCheckedChange={(checked) => {
                    const custoDireto = Boolean(checked);
                    setForm({
                      ...form,
                      custo_direto: custoDireto,
                      classificacao_despesa: custoDireto ? 'direta' : 'indireta',
                    });
                  }}
                  disabled={desligado}
                />
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <Label htmlFor="custo-direto" className="font-medium">
                    Custo direto do negócio
                  </Label>
                  <P38HelpPopover label="Ajuda: custo direto" side="top" align="start" size="sm">
                    <p className="text-muted-foreground">
                      Ativo por padrão. Desative para marcar como custo indireto ou de apoio.
                    </p>
                  </P38HelpPopover>
                </div>
              </div>
            </div>
          </div>

          {ehSocio ? (
            <div className="rounded-lg ring-1 ring-border/40 p-3 space-y-3">
              <Label className="font-medium">Retirada fixa</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Frequência</Label>
                  <Select
                    value={form.retirada_frequencia || 'mensal'}
                    onValueChange={(v) => setForm({ ...form, retirada_frequencia: v })}
                    disabled={desligado}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RETIRADA_FREQUENCIA_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.retirada_valor_fixo ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, retirada_valor_fixo: parseFloat(e.target.value) || 0 })
                    }
                    disabled={desligado}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Label>Salário base (R$)</Label>
              <Input
                className="mt-1.5"
                type="number"
                step="0.01"
                min={0}
                value={salarioBase}
                onChange={(e) => setSalarioBase(parseFloat(e.target.value) || 0)}
                disabled={desligado}
              />
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Encargos na projeção</span>
                <P38HelpPopover label="Ajuda: encargos" side="top" align="start" size="sm">
                  <p className="text-muted-foreground">
                    INSS, FGTS e encargos padrão entram na projeção automaticamente.
                  </p>
                </P38HelpPopover>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAvancadoAberto((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground py-1"
          >
            Programação avançada (13º, férias…)
            <ChevronDown className={`h-4 w-4 transition-transform ${avancadoAberto ? 'rotate-180' : ''}`} />
          </button>

          {avancadoAberto && !ehSocio && (
            <div className="space-y-3 rounded-lg ring-1 ring-border/40 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="decimo"
                  checked={form.decimo_terceiro_ativo !== false}
                  onCheckedChange={(v) => setForm({ ...form, decimo_terceiro_ativo: Boolean(v) })}
                  disabled={desligado}
                />
                <Label htmlFor="decimo">Incluir 13º na projeção</Label>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs">Férias programadas</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() =>
                      setForm({
                        ...form,
                        ferias_programadas: [
                          ...(form.ferias_programadas || []),
                          {
                            id: gerarIdInterno('fer'),
                            competencia_prevista: '',
                            valor_previsto: 0,
                            descricao: 'Férias',
                            status: 'previsto',
                          },
                        ],
                      })
                    }
                    disabled={desligado}
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {(form.ferias_programadas || []).map((f, idx) => (
                  <FeriasRow
                    key={f.id || idx}
                    ferias={f}
                    onChange={(nf) => updateFerias(idx, nf)}
                    onRemove={() =>
                      setForm({
                        ...form,
                        ferias_programadas: form.ferias_programadas.filter((_, i) => i !== idx),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {cadastro?.id && form.colaborador_id && !desligado && onDesligar && (
            <Button
              type="button"
              variant="outline"
              className="w-full text-red-700 dark:text-red-400"
              onClick={() => onDesligar(cadastro)}
            >
              Registrar saída…
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!podeSalvar || saving || desligado}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
