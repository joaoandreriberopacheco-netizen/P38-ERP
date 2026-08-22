import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { GlacialTabsList, GlacialTabsTrigger } from '@/components/ui/GlacialTabs';
import { QrCode, Package, Layers } from 'lucide-react';
import GestaoCodigosConferencia from '@/components/logistica/GestaoCodigosConferencia';
import PainelConferencias from '@/components/compras/PainelConferencias';
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

export default function ConferenciaEntrada() {
  const [activeTab, setActiveTab] = useState('codigos');

  const tabs = [
    { value: 'codigos', label: 'Gerar Códigos', icon: QrCode, pulseSensor: 'conferencia-entrada.tab-codigos' },
    { value: 'fiscalizacao', label: 'Fiscalização', icon: Layers },
  ];

  return (
    <div className="max-w-7xl mx-auto px-0 md:px-2 py-2 md:py-4">
      <div className="px-4 md:px-0 pb-4">
        <h1 className="text-xl md:text-2xl font-semibold text-foreground font-glacial">Conferência de Entrada</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Controle de conferência de volumes e itens</p>
      </div>

      <div className="px-4 md:px-0 mb-4">
        <GlacialTabsList>
          {tabs.map(tab => (
            <GlacialTabsTrigger
              key={tab.value}
              value={tab.value}
              activeValue={activeTab}
              onSelect={setActiveTab}
              icon={tab.icon}
              label={tab.label}
              pulseSensor={tab.pulseSensor}
            />
          ))}
        </GlacialTabsList>
      </div>

      <div className="px-4 md:px-0">
        {activeTab === 'codigos' && <ConferenciaCodigosTab />}
        {activeTab === 'fiscalizacao' && <PainelConferencias />}
      </div>
    </div>
  );
}

function ConferenciaCodigosTab() {
  const [supermanifestos, setSupermanifestos] = useState([]);
  const [manifestos, setManifestos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    try {
      const [smData, meData] = await Promise.all([
        base44.entities.Supermanifesto.list('-created_date', 50),
        base44.entities.ManifestoEntrada.list('-created_date', 50)
      ]);
      setSupermanifestos(smData);
      setManifestos(meData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;

  const manifestosPendentes = manifestos.filter(m => m.status_codigo_conferencia_itens !== 'Concluído');
  const supermanifestosPendentes = supermanifestos.filter(s => s.status_codigo_conferencia_volumes !== 'Concluído');

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">Geração de Códigos para Conferência</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Gere códigos únicos para conferência de volumes e itens. Os conferentes usarão estes códigos na armazenagem.
            </p>
          </div>
        </div>
      </div>

      {supermanifestosPendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground/90 mb-3">SUPERMANIFESTOS</h3>
          <P38MobileLineList>
            {supermanifestosPendentes.map((sm, index) => {
              const tone = p38StatusTone(sm.status);
              return (
                <P38MobileLine
                  key={sm.id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(tone)}
                  className="flex flex-col gap-3 p-3"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{sm.numero}</div>
                      <div className="text-xs text-muted-foreground truncate">{sm.transportadora_nome}</div>
                    </div>
                    <P38StatusLabel tone={tone}>{sm.status}</P38StatusLabel>
                  </div>
                  <GestaoCodigosConferencia manifesto={sm} tipo="volumes" onUpdate={carregarDados} />
                </P38MobileLine>
              );
            })}
          </P38MobileLineList>
        </div>
      )}

      {manifestosPendentes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground/90 mb-3">MANIFESTOS DE ENTRADA</h3>
          <P38MobileLineList>
            {manifestosPendentes.map((me, index) => {
              const tone = p38StatusTone(me.status);
              return (
                <P38MobileLine
                  key={me.id}
                  striped={index % 2 === 1}
                  accent={p38AccentKeyFromTone(tone)}
                  className="flex flex-col gap-3 p-3"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{me.numero}</div>
                      <div className="text-xs text-muted-foreground truncate">Pedido: {me.pedido_numero}</div>
                    </div>
                    <P38StatusLabel tone={tone}>{me.status}</P38StatusLabel>
                  </div>
                  <GestaoCodigosConferencia manifesto={me} tipo="itens" onUpdate={carregarDados} />
                </P38MobileLine>
              );
            })}
          </P38MobileLineList>
        </div>
      )}

      {manifestosPendentes.length === 0 && supermanifestosPendentes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Nenhum manifesto aguardando conferência</div>
      )}
    </div>
  );
}