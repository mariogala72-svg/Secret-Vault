import { ButtonLink } from "@/components/ui/button";
import { Aurora } from "@/components/ui/aurora";

export default function NotFound() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 text-center">
      <Aurora />
      <div>
        <p className="font-display text-8xl text-gradient">404</p>
        <h1 className="mt-4 font-display text-3xl">Questa pagina non esiste</h1>
        <p className="mt-2 text-muted">Forse il link è incompleto, o la pagina è stata spostata.</p>
        <ButtonLink href="/" className="mt-8">Torna alla home</ButtonLink>
      </div>
    </div>
  );
}
