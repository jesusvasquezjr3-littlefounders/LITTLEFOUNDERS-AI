import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AvatarOption {
  id: number;
  name: string;
  src: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

interface AvatarSelectorProps {
  avatars: AvatarOption[];
  selectedAvatar: AvatarOption;
  onAvatarSelect: (avatar: AvatarOption) => void;
  onCustomAvatarUpload?: (file: File) => void;
  disabled?: boolean;
  nickname?: string;
}

export function AvatarSelector({
  avatars,
  selectedAvatar,
  onAvatarSelect,
  onCustomAvatarUpload,
  disabled = false,
  nickname = "Usuario"
}: AvatarSelectorProps) {
  const { t } = useTranslation('profile');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setUploadError(t('messages.upload_error_type'));
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('messages.upload_error_size'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCustomAvatar(e.target?.result as string);
      setUploadError(null);
      if (onCustomAvatarUpload) {
        onCustomAvatarUpload(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeCustomAvatar = () => {
    setCustomAvatar(null);
    setUploadError(null);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "border-gray-300";
      case "rare": return "border-blue-400";
      case "epic": return "border-purple-400";
      case "legendary": return "border-yellow-400";
      default: return "border-gray-300";
    }
  };

  const getRarityLabel = (rarity: string) => {
    return t(`rarity.${rarity}`);
  };

  return (
    <div className="space-y-6">
      {/* Avatar actual */}
      <div className="text-center space-y-3">
        <Avatar className="w-24 h-24 mx-auto border-4 border-primary">
          <AvatarImage
            src={customAvatar || selectedAvatar.src}
            alt={selectedAvatar.name}
          />
          <AvatarFallback className="text-2xl">
            {nickname.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{selectedAvatar.name}</p>
          {customAvatar && (
            <Button
              variant="outline"
              size="sm"
              onClick={removeCustomAvatar}
              className="mt-2"
            >
              <X className="w-4 h-4 mr-1" />
              {t('actions.remove_photo')}
            </Button>
          )}
        </div>
      </div>

      {/* Subir foto personalizada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>{t('actions.upload_photo')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="avatar-upload">{t('actions.select_image')}</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="flex-1"
                disabled={disabled}
              />
              <Button variant="outline" disabled={disabled}>
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Formatos: JPG, PNG, GIF. Máximo 5MB.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Avatares prediseñados */}
      <Card>
        <CardHeader>
          <CardTitle>{t('sections.available_avatars')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:scale-105 ${selectedAvatar.id === avatar.id
                    ? 'border-primary bg-primary/10'
                    : getRarityColor(avatar.rarity)
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={() => !disabled && onAvatarSelect(avatar)}
              >
                <Avatar className="w-12 h-12 mx-auto">
                  <AvatarImage src={avatar.src} alt={avatar.name} />
                  <AvatarFallback className="text-xs">
                    {avatar.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs text-center mt-1 truncate">{avatar.name}</p>
                {avatar.rarity !== "common" && (
                  <Badge
                    variant="outline"
                    className="absolute -top-1 -right-1 text-xs px-1 py-0"
                  >
                    {getRarityLabel(avatar.rarity)}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
