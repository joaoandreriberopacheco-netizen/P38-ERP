import { useEffect, useState } from 'react';
import { ChevronRight, User, AlertCircle, Calendar, FileText, Dice5 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Dialog } from '@/components/ui/dialog';
import { CaixaDialogContent } from './CaixaDialogContent';
import { cn } from '@/lib/utils';
import { selectAllOnFocus } from '@/lib/inputFocusUtils';

/**
 * Modal Radix aninhado — fiado sobre o dialog de pagamento (clique/toque confiáveis).
 */
const PRAZOS = [
  { label: '7 dias',  dias: 7 },
  { label: '15 dias', dias: 15 },
  { label: '30 dias', dias: 30 },
  { label: '60 dias', dias: 60 },
  { label: '90 dias', dias: 90 },
];

export default function SeletorFiadoSheet({ visible, clienteNome, valorTotal, formatValor, onConfirm, onCancel }) {
  const [prazoDias, setPrazoDias] = useState(30);
  const [dataSelecionada, setDataSelecionada] = useState(null);
  const [observacao, setObservacao] = useState('');
  const [valor, setValor] = useState('');

  useEffect(() => {
    // Só reset ao ABRIR
    if (visible) {
      setPrazoDias(30);
      setDataSelecionada(null);
      setObservacao('');
      setValor('');
    }
  }, [visible]);

  const gerarDataAleatoria = () => {
    const diasMin = 7;
    const diasMax = 90;
    const diasAleatorios = Math.floor(Math.random() * (diasMax - diasMin + 1)) + diasMin;
    const novaData = addDays(new Date(), diasAleatorios);
    setDataSelecionada(novaData);
    setPrazoDias(null); // Desselecionar botões de dias
  };

  const dataVencimento = dataSelecionada
    ? format(dataSelecionada, 'dd/MM/yyyy')
    : format(addDays(new Date(), prazoDias), 'dd/MM/yyyy');

  const handleConfirmar = () => {
    if (dataSelecionada) {
      const diasDiferenca = Math.floor((dataSelecionada - new Date()) / (1000 * 60 * 60 * 24));
      onConfirm({ prazo_dias: diasDiferenca, data_vencimento: dataSelecionada, observacao, valor: valor ? parseFloat(valor.replace(/\D/g, '')) / 100 : null });
    } else {
      onConfirm({ prazo_dias: prazoDias, data_vencimento: addDays(new Date(), prazoDias), observacao, valor: valor ? parseFloat(valor.replace(/\D/g, '')) / 100 : null });
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <CaixaDialogContent
        nestedChild
        className={cn(
          'flex max-h-[min(90dvh,40rem)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-y-auto rounded-2xl border-0 bg-card p-5 shadow-2xl dark:bg-background sm:w-full',
          '[&>button]:hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground font-glacial">Fiado — Conta a Pagar</h3>
            <p className="text-xs text-muted-foreground">Configure o prazo de vencimento</p>
          </div>
        </div>

        {/* Cliente + Valor */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-xl">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground/90 font-medium">
              {clienteNome || 'Avulso'}
            </span>
          </div>
          <span className="text-base font-bold text-foreground tabular-nums">
            {formatValor(valorTotal)}
          </span>
        </div>

        {/* Seletor de prazo */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Prazo de vencimento</p>
          <div className="flex gap-2 flex-wrap">
            {PRAZOS.map(p => (
              <button
                key={p.dias}
                onClick={() => {
                  setPrazoDias(p.dias);
                  setDataSelecionada(null);
                }}
                className={`h-10 px-4 rounded-xl text-sm font-semibold transition-colors ${
                  prazoDias === p.dias && !dataSelecionada
                    ? 'bg-card text-card-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-primary/90'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={gerarDataAleatoria}
              className={`h-10 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                dataSelecionada
                  ? 'bg-card text-card-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-primary/90'
              }`}
            >
              <Dice5 className="w-4 h-4" />
              Aleatória
            </button>
          </div>

          {/* Data calculada */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50/60 rounded-xl mt-1">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Vencimento em</span>
            <span className="text-sm font-semibold text-foreground ml-auto">{dataVencimento}</span>
          </div>

          {/* Input customizado de data (opcional) */}
          <div className="space-y-1.5 mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Ou selecione uma data específica</p>
            <input autoComplete="off"
              type="date"
              value={dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                if (e.target.value) {
                  setDataSelecionada(new Date(e.target.value + 'T00:00:00'));
                  setPrazoDias(null);
                } else {
                  setDataSelecionada(null);
                }
              }}
              className="w-full px-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground/90 border border-border/40 focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring"
            />
          </div>
        </div>

        {/* Valor (opcional) */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Valor (opcional)</p>
          <input autoComplete="off"
            type="text"
            value={valor}
            onChange={(e) => {
              const numeros = e.target.value.replace(/\D/g, '');
              const formatado = (parseFloat(numeros || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              setValor(formatado);
            }}
            onFocus={selectAllOnFocus}
            placeholder="Ex: R$ 100,00"
            className="w-full px-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground/90 border border-border/40 focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring"
          />
        </div>

        {/* Observação */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Observação (opcional)</p>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: cliente conhece, vai pagar no final do mês..."
            rows={2}
            autoFocus={false}
            className="w-full px-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-border/40 dark:focus:ring-ring border-0 resize-none placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
          />
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 px-3 py-2 bg-muted/50/60 rounded-xl">
          <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Um lançamento financeiro de <strong>Receita Em Aberto</strong> será criado automaticamente com o prazo selecionado.
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-11 bg-muted text-foreground/90 rounded-xl text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="flex-1 h-11 bg-card text-card-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-1"
          >
            Confirmar <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </CaixaDialogContent>
    </Dialog>
  );
}