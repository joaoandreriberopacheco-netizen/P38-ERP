import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList, Play, CheckCircle2, Clock, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovaConferenciaDialog from "@/components/estoque/auditoria/NovaConferenciaDialog.jsx";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

const statusConfig = {
  "Rascunho": { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Rascunho" },
  "Em Andamento": { icon: Play, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Em Andamento" },
  "Aguardando Auditoria": { icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20", label: "Aguardando Auditoria" },
  "Concluída": { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20", label: "Concluída" },
  "Cancelada": { icon: XCircle, color: "text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: "Cancelada" },
};

export default function AuditoriaEstoque() {
  const [conferencias, setConferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    const data = await base44.entities.ConferenciaEstoque.list("-created_date", 50);
    setConferencias(data);
    setLoading(false);
  };

  const handleCriada = (nova) => {
    setShowNova(false);
    navigate(createPageUrl(`PDVAuditoria?id=${nova.id}`));
  };

  const abrirConferencia = (conf) => {
    navigate(createPageUrl(`PDVAuditoria?id=${conf.id}`));
  };

  const grupos = {
    ativas: conferencias.filter(c => ["Em Andamento", "Aguardando Auditoria", "Rascunho"].includes(c.status)),
    concluidas: conferencias.filter(c => ["Concluída", "Cancelada"].includes(c.status)),
  };

  return (
    <div className="min-h-screen bg-card w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 dark:bg-background/80 backdrop-blur-sm border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold font-glacial text-foreground">Auditoria de Estoque</h1>
          <p className="text-xs text-muted-foreground">{conferencias.length} conferência{conferencias.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          onClick={() => setShowNova(true)}
          className="bg-card text-card-foreground rounded-xl h-9 px-4 text-sm font-medium shadow-none"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova
        </Button>
      </div>

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Ativas */}
            {grupos.ativas.length > 0 && (
              <section>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Ativas</p>
                <div className="space-y-2">
                  {grupos.ativas.map(conf => (
                    <ConferenciaCard key={conf.id} conf={conf} onClick={abrirConferencia} />
                  ))}
                </div>
              </section>
            )}

            {/* Concluídas */}
            {grupos.concluidas.length > 0 && (
              <section>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Histórico</p>
                <P38MobileLineList>
                  {grupos.concluidas.map((conf, index) => (
                    <ConferenciaCard key={conf.id} conf={conf} onClick={abrirConferencia} striped={index % 2 === 1} />
                  ))}
                </P38MobileLineList>
              </section>
            )}

            {conferencias.length === 0 && (
              <div className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma conferência encontrada</p>
                <p className="text-muted-foreground dark:text-muted-foreground text-xs mt-1">Crie uma nova para começar</p>
              </div>
            )}
          </>
        )}
      </div>

      <NovaConferenciaDialog open={showNova} onClose={() => setShowNova(false)} onCriada={handleCriada} />
    </div>
  );
}

function ConferenciaCard({ conf, onClick, striped }) {
  const cfg = statusConfig[conf.status] || statusConfig["Rascunho"];
  const itens = conf.itens_conferidos?.length || 0;
  const tone = p38StatusTone(conf.status);
  const subtitle = [
    conf.tipo_conferencia,
    `${itens} item${itens !== 1 ? "s" : ""}`,
    conf.data_inicio ? format(new Date(conf.data_inicio), "dd/MM", { locale: ptBR }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <P38MobileLine
      as="button"
      type="button"
      striped={striped}
      accent={p38AccentKeyFromTone(tone)}
      onClick={() => onClick(conf)}
      title={conf.nome_conferencia}
      subtitle={subtitle}
      meta={<P38StatusLabel tone={tone}>{cfg.label}</P38StatusLabel>}
      trailing={<ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    />
  );
}