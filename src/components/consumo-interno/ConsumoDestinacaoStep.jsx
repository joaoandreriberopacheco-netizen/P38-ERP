import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

function Field({ label, children }) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function ConsumoDestinacaoStep({
  formData,
  setFormData,
  turnos,
  destinacoes,
  responsaveis,
  setNovoCadastro,
  destinacaoRef,
  responsavelRef,
  tagsRef,
  observacoesRef,
  onNext,
}) {
  return (
    <div className="rounded-[30px] bg-card p-5 shadow-sm dark:bg-muted">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Caixa ativo do dia">
          <Select value={formData.turno_caixa_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, turno_caixa_id: value }))}>
            <SelectTrigger className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {turnos.map((turno) => <SelectItem key={turno.id} value={turno.id}>{turno.conta_caixa_pdv_nome} · {turno.numero}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Destinação">
          <div className="flex gap-2">
            <Select value={formData.destinacao} onValueChange={(value) => setFormData((prev) => ({ ...prev, destinacao: value }))}>
              <SelectTrigger ref={destinacaoRef} className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background">
                <SelectValue placeholder="Escolha a destinação" />
              </SelectTrigger>
              <SelectContent>
                {destinacoes.map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-0 shadow-sm" onClick={() => setNovoCadastro({ tipo: 'destinacao', valor: '' })}><Plus className="h-4 w-4" /></Button>
          </div>
        </Field>

        <Field label="Interveniente / quem recebeu">
          <div className="flex gap-2">
            <Select value={formData.responsavel_recebimento} onValueChange={(value) => setFormData((prev) => ({ ...prev, responsavel_recebimento: value }))}>
              <SelectTrigger ref={responsavelRef} className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {responsaveis.map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-0 shadow-sm" onClick={() => setNovoCadastro({ tipo: 'responsavel', valor: '' })}><Plus className="h-4 w-4" /></Button>
          </div>
        </Field>

        <Field label="Tags">
          <Input ref={tagsRef} type="text" inputMode="text" className="h-11 rounded-2xl border-0 bg-muted shadow-sm dark:bg-background" placeholder="Ex: obra, manutenção" onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} />
        </Field>
      </div>

      <div className="mt-4">
        <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</Label>
        <Textarea ref={observacoesRef} className="min-h-[100px] rounded-[24px] border-0 bg-muted shadow-sm dark:bg-background" value={formData.observacoes} onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))} />
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={onNext} className="h-11 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-card dark:text-foreground md:w-44">
          Próximo
        </Button>
      </div>
    </div>
  );
}