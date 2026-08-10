import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, ChevronRight, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { cn } from '@/lib/utils';
import { getPrazoLiquidacaoMaquininha } from '@/lib/pagamentoPedidoVendaFinanceiro';
import { caixaSurface } from '@/lib/caixaP38Theme';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'];

/**
 * Modal Radix aninhado — recebe clique/toque corretamente sobre o dialog de pagamento.
 */
export default function SeletorMaquininhaSheet({ visible, modalidade, parcelas: parcelasIniciais = 1, onSelect, onCancel }) {
  const [maquininhas, setMaquininhas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState('');
  const [parcelas, setParcelas] = useState(parcelasIniciais);

  useEffect(() => {
    if (visible) {
      setSelecionada(null);
      setBandeiraSelecionada('');
      setParcelas(parcelasIniciais);
      loadMaquininhas();
    }
  }, [visible, modalidade, parcelasIniciais]);

  const loadMaquininhas = async () => {
    setLoading(true);
    const lista = await base44.entities.Maquininha.filter({ ativo: true });
    setMaquininhas(lista);
    setLoading(false);
  };

  const getTaxaParaMaquininha = (maq, bandeira) => {
    const cfg = (maq.bandeiras || []).find(b => b.bandeira === bandeira);
    if (!cfg) return 0;
    if (modalidade === 'debito') return cfg.taxa_debito || 0;
    if (parcelas === 1) return cfg.taxa_credito_1x || 0;
    if (parcelas <= 6) return cfg.taxa_credito_2_6x || 0;
    return cfg.taxa_credito_7_12x || 0;
  };

  const getPrazoDias = () => getPrazoLiquidacaoMaquininha();

  const handleConfirmar = () => {
    if (!selecionada || !bandeiraSelecionada) return;
    const taxa = getTaxaParaMaquininha(selecionada, bandeiraSelecionada);
    const prazo = getPrazoDias();
    onSelect({ maquininha: selecionada, bandeira: bandeiraSelecionada, taxa, prazo_dias: prazo, parcelas });
  };

  const bandeirasDisponiveis = selecionada
    ? (selecionada.bandeiras || []).map(b => b.bandeira).filter(Boolean)
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
            {/* Parcelas — só para crédito */}
            {modalidade === 'credito' && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Parcelas</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(p => (
                    <button
                      key={p}
                      onClick={() => setParcelas(p)}
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

            {/* Maquininhas */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Maquininha</p>
              {maquininhas.map(maq => (
                <button
                  key={maq.id}
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

            {/* Bandeiras */}
            {selecionada && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Bandeira</p>
                <div className="grid grid-cols-3 gap-2">
                  {bandeirasDisponiveis.map(b => {
                    const taxa = getTaxaParaMaquininha(selecionada, b);
                    return (
                      <button
                        key={b}
                        onClick={() => setBandeiraSelecionada(b)}
                        className={`flex flex-col items-center py-2 px-1 rounded-xl transition-colors text-sm ${
                          bandeiraSelecionada === b ? caixaSurface.chipSelected : caixaSurface.itemIdle
                        }`}
                      >
                        <span className="font-medium">{b}</span>
                        {taxa > 0 && <span className="text-xs opacity-60">{taxa}%</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resumo taxa */}
            {selecionada && bandeiraSelecionada && (() => {
              const taxa = getTaxaParaMaquininha(selecionada, bandeiraSelecionada);
              const prazo = getPrazoDias();
              return (
                <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground flex justify-between">
                  <span>Taxa: <b className="text-foreground/90">{taxa}%</b></span>
                  <span>Recebimento: <b className="text-foreground/90">D+{prazo}</b></span>
                  <span>Conta: <b className="text-foreground/90">{selecionada.conta_destino_nome || '—'}</b></span>
                </div>
              );
            })()}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onCancel}
                className={`flex-1 h-11 text-sm font-medium ${caixaSurface.secondaryBtn}`}
              >
                Cancelar
              </button>
              <button
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