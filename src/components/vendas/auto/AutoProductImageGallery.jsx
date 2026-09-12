import P38ProductGallery from '@/components/produtos/P38ProductGallery';

/** Galeria do auto-atendimento — delega ao componente PDP P38 partilhado. */
export default function AutoProductImageGallery(props) {
  return <P38ProductGallery layout="responsive" {...props} />;
}
