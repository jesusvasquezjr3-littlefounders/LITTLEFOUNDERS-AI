import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles } from "lucide-react";

interface BannerOption {
  id: number;
  name: string;
  src: string;
  category: string;
  unlocked: boolean;
  rarity?: "common" | "rare" | "epic" | "legendary";
}

interface BannerSelectorProps {
  banners: BannerOption[];
  selectedBanner: BannerOption;
  onBannerSelect: (banner: BannerOption) => void;
  disabled?: boolean;
}

export function BannerSelector({
  banners,
  selectedBanner,
  onBannerSelect,
  disabled = false
}: BannerSelectorProps) {
  const getRarityColor = (rarity?: string) => {
    switch (rarity) {
      case "rare": return "border-blue-400";
      case "epic": return "border-purple-400";
      case "legendary": return "border-yellow-400";
      default: return "border-gray-300";
    }
  };

  const getRarityLabel = (rarity?: string) => {
    switch (rarity) {
      case "rare": return "Raro";
      case "epic": return "Épico";
      case "legendary": return "Legendario";
      default: return "Común";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "nature": return "Naturaleza";
      case "space": return "Espacio";
      case "fantasy": return "Fantasía";
      case "abstract": return "Abstracto";
      default: return category;
    }
  };

  return (
    <div className="space-y-4">
      {/* Vista previa del banner seleccionado */}
      <div className="text-center space-y-3">
        <div 
          className="h-32 rounded-lg bg-cover bg-center mx-auto w-full max-w-md border-2 border-border"
          style={{ backgroundImage: `url(${selectedBanner.src})` }}
        />
        <div>
          <p className="font-medium">{selectedBanner.name}</p>
          <p className="text-sm text-muted-foreground">
            {getCategoryLabel(selectedBanner.category)}
          </p>
        </div>
      </div>

      {/* Grid de banners disponibles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>Fondos disponibles</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                  selectedBanner.id === banner.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : banner.unlocked 
                      ? getRarityColor(banner.rarity)
                      : 'border-border'
                } ${!banner.unlocked ? 'opacity-60' : ''} ${disabled ? 'cursor-not-allowed' : ''}`}
                onClick={() => !disabled && banner.unlocked && onBannerSelect(banner)}
              >
                <div 
                  className="h-24 bg-cover bg-center"
                  style={{ backgroundImage: `url(${banner.src})` }}
                />
                <div className="p-3 bg-background/95">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium truncate">{banner.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getCategoryLabel(banner.category)}
                      </p>
                    </div>
                    {banner.rarity && banner.rarity !== "common" && (
                      <Badge 
                        variant="outline" 
                        className="text-xs px-1 py-0"
                      >
                        {getRarityLabel(banner.rarity)}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Overlay para banners bloqueados */}
                {!banner.unlocked && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Lock className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-xs">Bloqueado</p>
                    </div>
                  </div>
                )}
                
                {/* Indicador de selección */}
                {selectedBanner.id === banner.id && (
                  <div className="absolute top-2 right-2">
                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información sobre desbloqueo */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <h3 className="font-medium">¿Cómo desbloquear más fondos?</h3>
            <p className="text-sm text-muted-foreground">
              Completa lecciones, alcanza metas de ahorro y participa en actividades 
              para desbloquear fondos exclusivos y personalizar tu perfil.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
