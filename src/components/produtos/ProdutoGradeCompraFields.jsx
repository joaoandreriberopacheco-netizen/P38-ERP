import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { isSupabaseBrowserConfigured } from '@/lib/supabaseBrowserClient';
import {
  fetchEixoValores,
  fetchLinhasCompra,
  fetchProdutosCompraByLinha,
} from '@/lib/produtoGradeCompra/fetchGradeCompra';
import { montarDescricaoSku } from '@/lib/produtoGradeCompra/montarDescricaoSku';

const P38_INPUT_UNDERLINE =
  'bg-transparent border-0 border-b border-border/40 dark:border-white/10 rounded-none px-0 h-9 text-sm text-foreground focus:border-[#4a5240] dark:focus:border-[#a4ce33]';

const TIPO_LABEL = {
  solo: 'Solo (sem grelha)',
  linha_mix: 'Linha — mix obrigatório',
  portfolio: 'Portfolio — modelos complementares',
};

/**
 * Cadastro por LINHA + PRODUTO_COMPRA + eixos A×B.
 * Hierarquia h1-h5 fica legado (fora deste bloco).
 */
export default function ProdutoGradeCompraFields({ formData, onPatch }) {
  const [linhas, setLinhas] = useState([]);
  const [produtosCompra, setProdutosCompra] = useState([]);
  const [eixosA, setEixosA] = useState([]);
  const [eixosB, setEixosB] = useState([]);
  const [loadErr, setLoadErr] = useState('');

  const supabaseOk = isSupabaseBrowserConfigured();
  const linhaId = formData.linha_compra_id || '';
  const produtoCompraId = formData.produto_compra_id || '';

  const linhaSel = useMemo(
    () => linhas.find((l) => l.id === linhaId) || null,
    [linhas, linhaId],
  );
  const produtoCompraSel = useMemo(
    () => produtosCompra.find((p) => p.id === produtoCompraId) || null,
    [produtosCompra, produtoCompraId],
  );

  const eixoARotulo = produtoCompraSel?.eixo_a_rotulo || linhaSel?.eixo_a_rotulo || 'Eixo A';
  const eixoBRotulo = produtoCompraSel?.eixo_b_rotulo || linhaSel?.eixo_b_rotulo || 'Eixo B';
  const tipoLinha = linhaSel?.tipo || '';
  const usaGrelha = tipoLinha === 'linha_mix' || tipoLinha === 'portfolio';

  useEffect(() => {
    if (!supabaseOk) return;
    fetchLinhasCompra()
      .then(setLinhas)
      .catch((e) => setLoadErr(e?.message || String(e)));
  }, [supabaseOk]);

  useEffect(() => {
    if (!linhaId || !supabaseOk) {
      setProdutosCompra([]);
      return;
    }
    fetchProdutosCompraByLinha(linhaId).then(setProdutosCompra).catch(() => setProdutosCompra([]));
  }, [linhaId, supabaseOk]);

  useEffect(() => {
    if (!supabaseOk || !usaGrelha) {
      setEixosA([]);
      setEixosB([]);
      return;
    }
    const load = async () => {
      const scope = { linhaId, produtoCompraId: produtoCompraId || undefined };
      const [a, b] = await Promise.all([
        fetchEixoValores({ ...scope, eixo: 'A' }),
        fetchEixoValores({ ...scope, eixo: 'B' }),
      ]);
      setEixosA(a);
      setEixosB(b);
    };
    load().catch(() => {
      setEixosA([]);
      setEixosB([]);
    });
  }, [linhaId, produtoCompraId, supabaseOk, usaGrelha]);

  const eixoASel = eixosA.find((e) => e.id === formData.eixo_a_valor_id);
  const eixoBSel = eixosB.find((e) => e.id === formData.eixo_b_valor_id);

  const previewNome = montarDescricaoSku({
    produtoCompraNome: produtoCompraSel?.nome || linhaSel?.nome || '',
    eixoANome: eixoASel?.nome || formData.eixo_a_texto || '',
    eixoBNome: eixoBSel?.nome || formData.eixo_b_texto || '',
    marca: formData.marca,
  });

  const patchWithNome = (patch) => {
    const next = { ...formData, ...patch };
    const pc =
      produtosCompra.find((p) => p.id === (patch.produto_compra_id ?? next.produto_compra_id))
      || produtoCompraSel;
    const linha =
      linhas.find((l) => l.id === (patch.linha_compra_id ?? next.linha_compra_id)) || linhaSel;
    const aVal = eixosA.find((e) => e.id === (patch.eixo_a_valor_id ?? next.eixo_a_valor_id));
    const bVal = eixosB.find((e) => e.id === (patch.eixo_b_valor_id ?? next.eixo_b_valor_id));
    const nome = montarDescricaoSku({
      produtoCompraNome: pc?.nome || linha?.nome || '',
      eixoANome: aVal?.nome || next.eixo_a_texto || '',
      eixoBNome: bVal?.nome || next.eixo_b_texto || '',
      marca: next.marca,
    });
    onPatch({ ...patch, ...(nome ? { nome } : {}) });
  };

  if (!supabaseOk) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
        Supabase não configurado — cadastro por grelha indisponível neste ambiente.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold p38-text-accent">Linha de compra e grelha</Label>
      </div>

      {loadErr ? (
        <p className="text-xs text-destructive">{loadErr}</p>
      ) : null}

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Linha *</Label>
        <Select
          value={linhaId || '__none__'}
          onValueChange={async (v) => {
            if (v === '__none__') {
              patchWithNome({
                linha_compra_id: '',
                produto_compra_id: '',
                eixo_a_valor_id: '',
                eixo_b_valor_id: '',
              });
              return;
            }
            const linha = linhas.find((l) => l.id === v);
            const pcs = await fetchProdutosCompraByLinha(v);
            const autoPc = linha?.tipo === 'solo' && pcs.length === 1 ? pcs[0].id : '';
            patchWithNome({
              linha_compra_id: v,
              produto_compra_id: autoPc,
              eixo_a_valor_id: '',
              eixo_b_valor_id: '',
              eixo_a_texto: '',
              eixo_b_texto: '',
              no_mix_ativo: linha?.tipo === 'portfolio',
            });
          }}
        >
          <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
            <SelectValue placeholder="Selecione a linha" />
          </SelectTrigger>
          <SelectContent className="z-[90] max-h-80">
            <SelectItem value="__none__">—</SelectItem>
            {linhas.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nome}
                {' '}
                <span className="text-muted-foreground text-[10px]">
                  (
                  {TIPO_LABEL[l.tipo] || l.tipo}
                  )
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {linhaSel && produtosCompra.length > 0 ? (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Produto de compra *</Label>
          <Select
            value={produtoCompraId || '__none__'}
            onValueChange={(v) => {
              patchWithNome({
                produto_compra_id: v === '__none__' ? '' : v,
                eixo_a_valor_id: '',
                eixo_b_valor_id: '',
              });
            }}
          >
            <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
              <SelectValue placeholder="Produto de compra" />
            </SelectTrigger>
            <SelectContent className="z-[90] max-h-80">
              <SelectItem value="__none__">—</SelectItem>
              {produtosCompra.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {usaGrelha && (produtoCompraId || tipoLinha === 'linha_mix') ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{eixoARotulo}</Label>
            {eixosA.length > 0 ? (
              <Select
                value={formData.eixo_a_valor_id || '__none__'}
                onValueChange={(v) => {
                  const id = v === '__none__' ? '' : v;
                  const val = eixosA.find((e) => e.id === id);
                  patchWithNome({
                    eixo_a_valor_id: id,
                    eixo_a_texto: val?.nome || '',
                  });
                }}
              >
                <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
                  <SelectValue placeholder={eixoARotulo} />
                </SelectTrigger>
                <SelectContent className="z-[90] max-h-60">
                  <SelectItem value="__none__">—</SelectItem>
                  {eixosA.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.eixo_a_texto || ''}
                onChange={(ev) => patchWithNome({ eixo_a_texto: ev.target.value, eixo_a_valor_id: '' })}
                className={P38_INPUT_UNDERLINE}
                placeholder={eixoARotulo}
              />
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{eixoBRotulo}</Label>
            {eixosB.length > 0 ? (
              <Select
                value={formData.eixo_b_valor_id || '__none__'}
                onValueChange={(v) => {
                  const id = v === '__none__' ? '' : v;
                  const val = eixosB.find((e) => e.id === id);
                  patchWithNome({
                    eixo_b_valor_id: id,
                    eixo_b_texto: val?.nome || '',
                  });
                }}
              >
                <SelectTrigger className={`${P38_INPUT_UNDERLINE} h-10`}>
                  <SelectValue placeholder={eixoBRotulo} />
                </SelectTrigger>
                <SelectContent className="z-[90] max-h-60">
                  <SelectItem value="__none__">—</SelectItem>
                  {eixosB.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.eixo_b_texto || ''}
                onChange={(ev) => patchWithNome({ eixo_b_texto: ev.target.value, eixo_b_valor_id: '' })}
                className={P38_INPUT_UNDERLINE}
                placeholder={eixoBRotulo}
              />
            )}
          </div>
        </div>
      ) : null}

      {tipoLinha === 'portfolio' ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="no_mix_ativo"
            checked={formData.no_mix_ativo === true}
            onCheckedChange={(c) => patchWithNome({ no_mix_ativo: c === true })}
          />
          <Label htmlFor="no_mix_ativo" className="text-xs cursor-pointer">
            Faz parte do mix activo (cobertura)
          </Label>
        </div>
      ) : null}

      {tipoLinha === 'linha_mix' ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="celula_obrigatoria"
            checked={formData.celula_obrigatoria === true}
            onCheckedChange={(c) => patchWithNome({ celula_obrigatoria: c === true })}
          />
          <Label htmlFor="celula_obrigatoria" className="text-xs cursor-pointer">
            Célula obrigatória no mix
          </Label>
        </div>
      ) : null}

      {previewNome ? (
        <div className="px-3 py-2 rounded-lg border border-border/40 bg-[#26262e]/20">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Preview descrição (grelha)</p>
          <p className="text-sm font-medium uppercase tracking-wide">{previewNome}</p>
        </div>
      ) : null}
    </div>
  );
}
