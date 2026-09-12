import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { AUTO_COVER_CLASS, AUTO_PRIMARY_BTN } from './autoAtendimentoUi';

export default function AutoWelcomeBanner({ config, onUpdateConfig, visible }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    if (config) setEditForm(config);
  }, [config]);

  const handleSaveConfig = async () => {
    try {
      await base44.entities.ConfigAutoAtendimento.update(config.id, editForm);
      await onUpdateConfig();
      setIsEditing(false);
      toast({ title: 'Configuração atualizada!' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  if (!config || !visible) return null;

  return (
    <div
      className={`relative mx-4 mt-3 mb-2 rounded-2xl overflow-hidden ${AUTO_COVER_CLASS} shadow-md shrink-0`}
      style={{
        backgroundImage: config.imagem_fundo_url
          ? `linear-gradient(to bottom, rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.85)), url(${config.imagem_fundo_url})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="p-6 md:p-8 relative z-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{config.titulo_boas_vindas}</h2>
        <p className="text-sm md:text-base text-indigo-100 mt-1 max-w-2xl">{config.subtitulo_boas_vindas}</p>
      </div>

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="absolute top-3 right-3 p-2 rounded-full bg-black/25 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
        aria-label="Editar banner"
      >
        <Edit3 className="w-4 h-4" />
      </button>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar banner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={editForm.titulo_boas_vindas || ''}
                onChange={(e) => setEditForm({ ...editForm, titulo_boas_vindas: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input
                value={editForm.subtitulo_boas_vindas || ''}
                onChange={(e) => setEditForm({ ...editForm, subtitulo_boas_vindas: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL da imagem de fundo</Label>
              <Input
                value={editForm.imagem_fundo_url || ''}
                onChange={(e) => setEditForm({ ...editForm, imagem_fundo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} className={AUTO_PRIMARY_BTN}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
