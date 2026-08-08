import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, ChevronRight, AlertCircle, Users, Building2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { cn } from '@/lib/utils';
import { getPrazoLiquidacaoMaquininha } from '@/lib/pagamentoPedidoVendaFinanceiro';
import { calcularTaxaFromMaquininha } from '@/lib/taxaMaquininha';
import { validarPagamentoCartaoLoja } from '@/lib/condicaoComercialVenda';
import { caixaSurface } from '@/lib/caixaP38Theme';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];
const PARCELAS_COMPRADOR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Modal Radix aninhado — recebe clique/toque corretamente sobre o dialog de pagamento.
 */
export default function SeletorMaquininhaSheet({
  visible,
  modalidade,
  parcelas: parcelasIniciais = 1,
  politicaVenda = null,
  subtotalPedido = 0,
  valorDescontoPedido = 0,
  onSelect,
  onCancel,
}) {
  const [maquininhas, setMaquininhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState('');
  const [parcelas, setParcelas] = useState(parcelasIniciais);
  const [jurosComprador, setJurosComprador] = useState(false);
  const [erroPolitica, setErroPolitica] = useState('');

  const maxParcelasLoja = politicaVenda?.max_parcelas_loja ?? 12;

  const parcelasOpcoes = useMemo(() => {
    if (modalidade !== 'credito') return [1];
    if (jurosComprador) return PARCELAS_COMPRADOR;
    return PARCELAS_COMPRADOR.filter((p) => p <= maxParcelasLoja);
  }, [modalidade, jurosComprador, maxParcelasLoja]);

  useEffect(() => {
    if (visible) {
      setSelecionada(null);
      setBandeiraSelecionada('');
      setParcelas(parcelasIniciais);
      setJurosComprador(false);
      setErroPolitica('');
      loadMaquininhas();
    }
  }, [visible, modalidade, parcelasIniciais]);

  useEffect(() => {
    if (!parcelasOpcoes.includes(parcelas)) {
      setParcelas(parcelasOpcoes[parcelasOpcoes.length - 1] ?? 1);
    }
  }, [parcelasOpcoes, parcelas]);

  const loadMaquininhas = async () => {
    setLoading(true);
    const lista = await base44.entities.Maquininha.filter({ ativo: true });
    setMaquininhas(lista);
    setLoading(false);
  };

  const getTaxaParaMaquininha = (maq, bandeira) => {
    if (jurosComprador) {
      return calcularTaxaFromMaquininha(maq, bandeira, 'Crédito à Vista', 1).taxa_total;
    }
    const mod = modalidade === 'debito' ? 'Débito' : (parcelas === 1 ? 'Crédito à Vista' : 'Crédito Parcelado');
    return calcularTaxaFromMaquininha(maq, bandeira, mod, parcelas).taxa_total;
  };

  const getPrazoDias = () => getPrazoLiquidacaoMaquininha();

  const handleConfirmar = () => {
    if (!selecionada || !bandeiraSelecionada) return;
    const taxa = getTaxaParaMaquininha(selecionada, bandeiraSelecionada);

    if (modalidade === 'credito' && politicaVenda && !jurosComprador) {
      const validacao = validarPagamentoCartaoLoja({
        condicaoComEntrega: politicaVenda.condicao_com_entrega,
        subtotal: subtotalPedido,
        valorDesconto: valorDescontoPedido,
        taxaTotalPct: taxa,
        parcelas,
      });
      if (!validacao.ok) {
        setErroPolitica(validacao.motivo);
        return;
      }
    }

    setErroPolitica('');
    onSelect({
      maquininha: selecionada,
      bandeira: bandeiraSelecionada,
      taxa,
      prazo_dias: getPrazoDias(),
      parcelas,
      juros_cliente: jurosComprador,
    });
  };

  const bandeirasDisponiveis = selecionada
    ? (selecionada.bandeiras || []).map((b) => b.bandeira).filter(Boolean)
    : BANDEIRAS;

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <CaixaDialogContent
        nestedChild
        className={cn(
          'flex max-h-[min(90dvh,36rem)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-y-auto rounded-2xl border-0 bg-card p-5 shadow-2xl dark:bg-background sm:w-full',
          '[&>button]:hidden'
        )}
      >
        <div className="flex items-center gap-3 mb-1">
          <CreditCard className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground font-glacial">
              {modalidade === 'debito' ? 'Cartão Débito' : `Cartão Crédito${parcelas > 1 ? ` ${parcelas}x` : ''}`}
            </h3>
            <p className="text-xs text-muted-foreground">Maquininha e bandeira</p>
          </div>
        </div>

        {politicaVenda && modalidade === 'credito' && (
          <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-2">
            <span className="font-medium text-foreground/90">{politicaVenda.label}:</span>{' '}
            {politicaVenda.resumo_caixa}. Juros do comprador: sem limite de parcelas.
          </p>
        )}

        {loading && (
          <div className="py-6 text-center text-muted-foreground text-sm">Carregando maquininhas...</div>
        )}

        {!loading && maquininhas.length === 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Nenhuma maquininha cadastrada. Cadastre em Configurações → Maquininhas.
            </p>
          </div>
        )}

        {!loading && maquininhas.length > 0 && (
          <>
            {modalidade === 'credito' && (
              <div className="flex rounded-xl overflow-hidden bg-muted p-0.5 gap-0.5 mb-2">
                <button
                  type="button"
                  onClick={() => { setJurosComprador(false); setErroPolitica(''); }}
                  className={`flex-1 flex items-center justify-center gap-1 h-9 rounded-lg text-[11px] font-medium transition-all ${
                    !jurosComprador ? 'bg-card dark:bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> Loja absorve
                </button>
                <button
                  type="button"
                  onClick={() => { setJurosComprador(true); setErroPolitica(''); }}
                  className={`flex-1 flex items-center justify-center gap-1 h-9 rounded-lg text-[11px] font-medium transition-all ${
                    jurosComprador ? 'bg-card dark:bg-muted text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> Juros do comprador
                </button>
              </div>
            )}

            {modalidade === 'credito' && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Parcelas</p>
                <div className="flex gap-1.5 flex-wrap">
                  {parcelasOpcoes.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setParcelas(p); setErroPolitica(''); }}
                      className={`w-10 h-9 rounded-xl text-sm font-semibold transition-colors ${
                        parcelas === p ? caixaSurface.chipSelected : caixaSurface.chipIdle
                      }`}
                    >
                      {p}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Maquininha</p>
              {maquininhas.map((maq) => (
                <button
                  key={maq.id}
                  type="button"
                  onClick={() => { setSelecionada(maq); setBandeiraSelecionada(''); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left ${
                    selecionada?.id === maq.id ? caixaSurface.itemSelected : caixaSurface.itemIdle
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{maq.nome}</div>
                    {maq.adquirente && <div className="text-xs opacity-60">{maq.adquirente}</div>}
                  </div>
                  <div className="text-xs opacity-60">D+{getPrazoDias()}</div>
                </button>
              ))}
            </div>

            {selecionada && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Bandeira</p>
                <div className="grid grid-cols-3 gap-2">
                  {bandeirasDisponiveis.map((b) => {
                    const taxa = getTaxaParaMaquininha(selecionada, b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBandeiraSelecionada(b)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl transition-colors text-sm ${
                          bandeiraSelecionada === b ? caixaSurface.chipSelected : caixaSurface.itemIdle
                        }`}
                      >
                        <span className="font-medium">{b}</span>
                        {taxa > 0 && <span className="text-xs opacity-60">{taxa.toFixed(2)}%</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {erroPolitica && (
              <div className="flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{erroPolitica}</span>
              </div>
            )}

            {selecionada && bandeiraSelecionada && (() => {
              const taxa = getTaxaParaMaquininha(selecionada, bandeiraSelecionada);
              return (
                <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span>Taxa loja: <b className="text-foreground/90">{taxa.toFixed(2)}%</b></span>
                  {jurosComprador && parcelas > 1 && (
                    <span className="text-emerald-600 dark:text-emerald-400">Cliente paga juros nas parcelas</span>
                  )}
                  <span>Recebimento: <b className="text-foreground/90">D+{getPrazoDias()}</b></span>
                </div>
              );
            })()}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className={`flex-1 h-11 text-sm font-medium ${caixaSurface.secondaryBtn}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={!selecionada || !bandeiraSelecionada}
                className={`flex-1 h-11 text-sm flex items-center justify-center gap-1 ${caixaSurface.confirmBtn}`}
              >
                Confirmar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </CaixaDialogContent>
    </Dialog>
  );
}
