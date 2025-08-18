import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Edit3, CheckCircle, AlertCircle } from "lucide-react";

interface ProfileInfoProps {
  nickname: string;
  bio: string;
  onNicknameChange: (nickname: string) => void;
  onBioChange: (bio: string) => void;
  disabled?: boolean;
}

export function ProfileInfo({
  nickname,
  bio,
  onNicknameChange,
  onBioChange,
  disabled = false
}: ProfileInfoProps) {
  const validateNickname = (nickname: string) => {
    // Solo letras, números, guiones bajos y guiones medios
    const regex = /^[a-zA-Z0-9_-]+$/;
    return regex.test(nickname);
  };

  const isNicknameValid = validateNickname(nickname);
  const isNicknameLengthValid = nickname.length >= 3 && nickname.length <= 20;
  const isBioLengthValid = bio.length <= 150;

  const getNicknameStatus = () => {
    if (nickname.length === 0) return { valid: true, message: "" };
    if (!isNicknameLengthValid) {
      return { 
        valid: false, 
        message: "El nickname debe tener entre 3 y 20 caracteres" 
      };
    }
    if (!isNicknameValid) {
      return { 
        valid: false, 
        message: "Solo letras, números, guiones bajos (_) y medios (-)" 
      };
    }
    return { valid: true, message: "Nickname válido" };
  };

  const nicknameStatus = getNicknameStatus();

  return (
    <div className="space-y-6">
      {/* Vista previa del perfil */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold">
              {nickname.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{nickname || "Tu nickname"}</h3>
              <p className="text-sm text-muted-foreground">
                {bio || "Tu biografía aparecerá aquí..."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de información */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Información Personal</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nickname */}
          <div className="space-y-2">
            <Label htmlFor="nickname" className="flex items-center space-x-2">
              <span>Nickname</span>
              {nicknameStatus.valid && nickname.length > 0 && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {!nicknameStatus.valid && nickname.length > 0 && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder="Escribe tu nickname"
              disabled={disabled}
              maxLength={20}
              className={!nicknameStatus.valid && nickname.length > 0 ? "border-red-500" : ""}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {nicknameStatus.message}
              </p>
              <p className="text-xs text-muted-foreground">
                {nickname.length}/20
              </p>
            </div>
            
            {/* Sugerencias de nickname */}
            {nickname.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Sugerencias:</p>
                <div className="flex flex-wrap gap-2">
                  {["PequeñoFundador", "AhorradorPro", "FinanzasKid", "MoneyMaster", "SavingsStar"].map((suggestion) => (
                    <Badge 
                      key={suggestion}
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => !disabled && onNicknameChange(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Biografía */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="flex items-center space-x-2">
              <span>Biografía</span>
              {isBioLengthValid && bio.length > 0 && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {!isBioLengthValid && bio.length > 0 && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="Cuéntanos sobre ti, tus intereses o tu motivación para aprender sobre finanzas..."
              disabled={disabled}
              maxLength={150}
              rows={4}
              className={!isBioLengthValid && bio.length > 0 ? "border-red-500" : ""}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Puedes usar emojis para hacer tu biografía más divertida! ✨
              </p>
              <p className="text-xs text-muted-foreground">
                {bio.length}/150
              </p>
            </div>

            {/* Emojis sugeridos */}
            {bio.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Emojis populares:</p>
                <div className="flex flex-wrap gap-2">
                  {["💰", "✨", "🎯", "📚", "🚀", "💡", "🌟", "🎉", "💪", "🎨"].map((emoji) => (
                    <button
                      key={emoji}
                      className="text-lg hover:scale-125 transition-transform cursor-pointer"
                      onClick={() => !disabled && onBioChange(bio + emoji)}
                      disabled={disabled}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Información de seguridad */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs">ℹ️</span>
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Información segura</h4>
                  <p className="text-sm text-blue-700">
                    Tu nickname y biografía son visibles para otros usuarios. 
                    No incluyas información personal como tu nombre real, edad, 
                    dirección o información de contacto.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
