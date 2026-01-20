import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Info, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

interface ProfileInfoProps {
  nickname: string;
  bio: string;
  onNicknameChange: (value: string) => void;
  onBioChange: (value: string) => void;
  disabled?: boolean;
}

export function ProfileInfo({
  nickname,
  bio,
  onNicknameChange,
  onBioChange,
  disabled = false
}: ProfileInfoProps) {
  const { t } = useTranslation('profile');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>{t('sections.personal_info')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">{t('fields.nickname')}</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder={t('fields.nickname_placeholder')}
              disabled={disabled}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              {t('fields.suggestions')} "Capitán Ahorro", "Explorador Espacial", "Finanzas Ninja"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">{t('fields.bio')}</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder={t('fields.bio_placeholder')}
              disabled={disabled}
              className="resize-none min-h-[100px]"
              maxLength={150}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('fields.popular_emojis')} 🚀 💰 ✨ 🌟 🎮 📚</span>
              <span>{bio.length}/150</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>{t('sections.preferences')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('fields.language')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('fields.language_desc')}
              </p>
            </div>
            <LanguageSelector variant="full" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">{t('sections.security_info')}</h4>
              <p className="text-sm text-yellow-800 mt-1">
                {t('sections.security_desc')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
