import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Play, CheckCircle2, Clock, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NovaConferenciaDialog from "@/components/estoque/auditoria/NovaConferenciaDialog.jsx";
import { P38MobileLine, P38MobileLineList, P38StatusLabel, p38StatusTone, p38AccentKeyFromTone } from '@/components/ui/p38-mobile-line';

const statusConfig = {
  "Rascunho": { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Rascunho" },
  "Em Andamento": { icon: Play, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Em Andamento" },
  "Aguardando Auditoria": { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted", label: "Aguardando" },
  "Concluída": { icon: CheckCircle2, color: "text-[#4A5D23] dark:text-[#a4ce33]", bg: "bg-secondary/30 dark:bg-secondary/20", label: "Concluída" },
  "Cancelada": { icon: XCircle, color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", label: "Cancelada" },
};

export default function ListaConferencias({ onAbrirConferencia, onAbrirAuditoria, modoFiltro }) {
  const [conferencias, setConferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    const data = await base44.entities.ConferenciaEstoque.list("-created_date", 50);
    setConferencias(data);
    setLoading(false);
  };

  const handleCriada = async (nova) => {
    setShowNova(false);
    await carregar();
    onAbrirConferencia(nova);
  };

  const statusContagem = ["Rascunho", "Em Andamento"];
  const statusAuditoria = ["Aguardando Auditoria", "Concluída", "Cancelada"];

  const lista = modoFiltro === "contagem"
    ? conferencias.filter(c => statusContagem.includes(c.status))
    : modoFiltro === "auditoria"
    ? conferencias.filter(c => statusAuditoria.includes(c.status))
    : conferencias;

  const grupos = {
    ativas: lista.filter(c => ["Em Andamento", "Aguardando Auditoria", "Rascunho"].includes(c.status)),
    concluidas: lista.filter(c => ["Concluída", "Cancelada"].includes(c.status)),
  };

  const handleClick = (conf) => {
    if (conf.status === "Aguardando Auditoria" && onAbrirAuditoria) {
      onAbrirAuditoria(conf);
    } else {
      onAbrirConferencia(conf);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-4 min-w-0">
        <div>
          <h2 className="text-base font-semibold font-glacial text-foreground">
            {modoFiltro === "auditoria" ? "Auditoria" : "Contagem de Estoque"}
          </h2>
          <p className="text-xs text-muted-foreground">{lista.length} conferência{lista.length !== 1 ? "s" : ""}</p>
        </div>
        {modoFiltro !== "auditoria" && (
          <Button
            onClick={() => setShowNova(true)}
            className="bg-card text-card-foreground rounded-xl h-9 px-4 text-sm font-medium shadow-none"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.ativas.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Ativas</p>
              <P38MobileLineList>
                {grupos.ativas.map((conf, index) => (
                  <ConferenciaLine key={conf.id} conf={conf} onClick={handleClick} striped={index % 2 === 1} />
                ))}
              </P38MobileLineList>
            </section>
          )}

          {grupos.concluidas.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">Histórico</p>
              <P38MobileLineList>
                {grupos.concluidas.map((conf, index) => (
                  <ConferenciaLine key={conf.id} conf={conf} onClick={handleClick} striped={index % 2 === 1} />
                ))}
              </P38MobileLineList>
            </section>
          )}

          {lista.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="w-7 h-7 text-muted-foreground dark:text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">Nenhuma conferência encontrada</p>
              {modoFiltro !== "auditoria" && (
                <p className="text-muted-foreground dark:text-muted-foreground text-xs mt-1">Crie uma nova para começar</p>
              )}
            </div>
          )}
        </div>
      )}

      <NovaConferenciaDialog open={showNova} onClose={() => setShowNova(false)} onCriada={handleCriada} />
    </div>
  );
}

function ConferenciaLine({ conf, onClick, striped }) {
  const cfg = statusConfig[conf.status] || statusConfig["Rascunho"];
  const Icon = cfg.icon;
  const itens = conf.itens_conferidos?.length || 0;
  const tone = p38StatusTone(conf.status);
  const dataInicio = conf.data_inicio
    ? format(new Date(conf.data_inicio), "dd/MM", { locale: ptBR })
    : null;

  return (
    <P38MobileLine
      as="button"
      type="button"
      onClick={() => onClick(conf)}
      striped={striped}
      accent={p38AccentKeyFromTone(tone)}
      title={conf.nome_conferencia}
      subtitle={conf.tipo_conferencia}
      meta={
        <>
          <P38StatusLabel tone={tone}>{cfg.label}</P38StatusLabel>
          <span>{itens} item{itens !== 1 ? "s" : ""}</span>
          {dataInicio ? <span className="tabular-nums">{dataInicio}</span> : null}
        </>
      }
      trailing={
        <div className="flex items-center gap-1 shrink-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bg}`}>
            <Icon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        </div>
      }
    />
  );
}
