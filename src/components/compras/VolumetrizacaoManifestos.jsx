import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Edit, RefreshCw, Boxes } from 'lucide-react';
import LoteVolumesGenericosDialog from '@/components/compras/LoteVolumesGenericosDialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

const getStatusBadge = (status) => {
  // Glacial Palette
  const variants = {
    'Aguardando Conferência': 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    'Em Conferência': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    'Conferido': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    'Com Divergências': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    'Finalizado': 'bg-muted/40 text-muted-foreground dark:bg-muted dark:text-foreground/90'
  };
  return variants[status] || 'bg-muted/40 text-muted-foreground dark:bg-muted dark:text-foreground/90';
};

export default function VolumetrizacaoManifestos() {
  const navigate = useNavigate();
  const [manifestos, setManifestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLoteDialog, setShowLoteDialog] = useState(false);

  useEffect(() => {
    loadManifestos();
    
    // Real-time subscription
    const unsubscribe = base44.entities.ManifestoEntrada.subscribe((event) => {
      loadManifestos();
    });

    return () => unsubscribe();
  }, []);

  const loadManifestos = async () => {
    try {
      setLoading(true);
      const data = await base44.entities.ManifestoEntrada.list('-created_date');
      setManifestos(data);
    } catch (error) {
      console.error("Erro ao carregar manifestos:", error);
      toast.error("Erro ao carregar manifestos");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscriminarVolumes = (manifesto) => {
    navigate(createPageUrl(`DiscriminarVolumes?id=${manifesto.id}&tipo=manifesto`));
  };

  const manifestosFiltrados = manifestos.filter(m => {
    const matchSearch = m.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       m.fornecedor_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       m.pedido_numero?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filtros - Glacial */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por número, pedido ou fornecedor..." 
            className="h-11 pl-11 bg-card border-0 rounded-2xl shadow-sm text-foreground dark:text-foreground placeholder:text-muted-foreground" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <Button
          onClick={() => setShowLoteDialog(true)}
          disabled={manifestosFiltrados.length === 0}
          className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-muted dark:hover:bg-muted/90 dark:text-foreground shadow-sm gap-2"
        >
          <Boxes className="w-4 h-4" />
          Criar em lote
        </Button>
      </div>

      {/* Lista de Manifestos - Glacial */}
      <div className="grid gap-3">
        {manifestosFiltrados.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl ring-1 ring-border/30 dark:ring-border/40">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-light">Nenhum manifesto encontrado</p>
          </div>
        ) : (
          manifestosFiltrados.map(m => (
            <div key={m.id} className="group bg-card p-4 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Informações */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                    <Package className="w-4 h-4 stroke-[1.5]" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-base font-semibold text-foreground dark:text-foreground tracking-tight">{m.numero}</span>
                      <Badge className={`font-normal rounded-full px-3 ${getStatusBadge(m.status)}`}>
                        {m.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Pedido</span>
                        <span className="font-medium text-foreground/90">{m.pedido_numero}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Fornecedor</span>
                        <span className="truncate text-foreground/90">{m.fornecedor_nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Volumes</span>
                        <span className="truncate text-foreground/90">
                          {(() => {
                            const qtd = m.volumes?.reduce((acc, v) => acc + (v.quantidade || 0), 0) || 0;
                            return qtd > 0 ? qtd : 'Não informado';
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ação */}
                <Button 
                  variant="outline" 
                  onClick={() => handleDiscriminarVolumes(m)}
                  className="gap-2 text-muted-foreground border-0 bg-muted hover:bg-muted dark:hover:bg-muted rounded-2xl h-10 px-4 w-full md:w-auto font-medium shadow-sm"
                >
                  <Edit className="w-4 h-4 text-muted-foreground" />
                  Discriminar Volumes
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <LoteVolumesGenericosDialog
        isOpen={showLoteDialog}
        onClose={() => setShowLoteDialog(false)}
        manifestos={manifestosFiltrados}
        onSuccess={loadManifestos}
      />
    </div>
  );
}