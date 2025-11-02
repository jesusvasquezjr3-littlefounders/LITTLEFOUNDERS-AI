import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Edit3, 
  Save, 
  X, 
  Star,
  Trophy,
  BookOpen,
  Target,
  Coins,
  Shield,
  Crown,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AvatarSelector } from "@/components/profile/AvatarSelector";
import { BannerSelector } from "@/components/profile/BannerSelector";
import { BadgeSelector } from "@/components/profile/BadgeSelector";
import { ProfileInfo } from "@/components/profile/ProfileInfo";

// Datos de ejemplo para avatares prediseñados
const predefinedAvatars = [
  { id: 1, name: "Explorador", src: "/avatars/explorer.png", rarity: "common" as const },
  { id: 2, name: "Astrónomo", src: "/avatars/astronomer.png", rarity: "common" as const },
  { id: 3, name: "Inventor", src: "/avatars/inventor.png", rarity: "rare" as const },
  { id: 4, name: "Mago", src: "/avatars/wizard.png", rarity: "rare" as const },
  { id: 5, name: "Dragón", src: "/avatars/dragon.png", rarity: "epic" as const },
  { id: 6, name: "Fénix", src: "/avatars/phoenix.png", rarity: "epic" as const },
  { id: 7, name: "Unicornio", src: "/avatars/unicorn.png", rarity: "legendary" as const },
  { id: 8, name: "Robot", src: "/avatars/robot.png", rarity: "legendary" as const },
  { id: 9, name: "Ninja", src: "/avatars/ninja.png", rarity: "rare" as const },
  { id: 10, name: "Pirata", src: "/avatars/pirate.png", rarity: "rare" as const },
  { id: 11, name: "Superhéroe", src: "/avatars/superhero.png", rarity: "epic" as const },
  { id: 12, name: "Alien", src: "/avatars/alien.png", rarity: "epic" as const },
];

// Fondos de perfil disponibles
const profileBanners = [
  { id: 1, name: "Cielo Azul", src: "/banners/blue-sky.jpg", category: "nature", unlocked: true, rarity: "common" as const },
  { id: 2, name: "Bosque Mágico", src: "/banners/magic-forest.jpg", category: "nature", unlocked: true, rarity: "common" as const },
  { id: 3, name: "Espacio", src: "/banners/space.jpg", category: "space", unlocked: true, rarity: "rare" as const },
  { id: 4, name: "Océano", src: "/banners/ocean.jpg", category: "nature", unlocked: true, rarity: "common" as const },
  { id: 5, name: "Galaxia", src: "/banners/galaxy.jpg", category: "space", unlocked: false, rarity: "epic" as const },
  { id: 6, name: "Aurora", src: "/banners/aurora.jpg", category: "nature", unlocked: false, rarity: "epic" as const },
  { id: 7, name: "Montañas", src: "/banners/mountains.jpg", category: "nature", unlocked: true, rarity: "common" as const },
  { id: 8, name: "Nebulosa", src: "/banners/nebula.jpg", category: "space", unlocked: false, rarity: "legendary" as const },
  { id: 9, name: "Atardecer", src: "/banners/sunset.jpg", category: "nature", unlocked: true, rarity: "rare" as const },
];

// Badges y logros del usuario
const userBadges = [
  { id: 1, name: "Primer Ahorro", icon: Coins, color: "text-yellow-500", description: "Ahorraste tu primera moneda", earned: true, rarity: "common" as const, earnedDate: "2024-01-15" },
  { id: 2, name: "Estudiante Dedicado", icon: BookOpen, color: "text-blue-500", description: "Completaste 10 lecciones", earned: true, rarity: "common" as const, earnedDate: "2024-01-20" },
  { id: 3, name: "Meta Alcanzada", icon: Target, color: "text-green-500", description: "Lograste tu primera meta de ahorro", earned: true, rarity: "rare" as const, earnedDate: "2024-02-01" },
  { id: 4, name: "Protector", icon: Shield, color: "text-purple-500", description: "Aprendiste sobre seguridad financiera", earned: false, rarity: "rare" as const },
  { id: 5, name: "Rey del Ahorro", icon: Crown, color: "text-orange-500", description: "Ahorraste $100", earned: false, rarity: "epic" as const },
  { id: 6, name: "Super Estrella", icon: Star, color: "text-pink-500", description: "Completaste 50 lecciones", earned: false, rarity: "epic" as const },
  { id: 7, name: "Inversor Junior", icon: Sparkles, color: "text-indigo-500", description: "Aprendiste sobre inversiones", earned: true, rarity: "rare" as const, earnedDate: "2024-02-10" },
  { id: 8, name: "Maestro del Presupuesto", icon: Target, color: "text-emerald-500", description: "Creaste 5 presupuestos exitosos", earned: false, rarity: "legendary" as const },
];

const Profile = () => {
  const [profile, setProfile] = useState({
    nickname: "PequeñoFundador",
    bio: "¡Aprendiendo sobre finanzas mientras me divierto! 💰✨",
    avatar: predefinedAvatars[0],
    banner: profileBanners[0],
    selectedBadges: [1, 2, 3], // IDs de badges seleccionados para mostrar
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState(profile);
  const { toast } = useToast();

  const handleSave = () => {
    setProfile(tempProfile);
    setIsEditing(false);
    toast({
      title: "¡Perfil actualizado!",
      description: "Tus cambios han sido guardados exitosamente.",
    });
  };

  const handleCancel = () => {
    setTempProfile(profile);
    setIsEditing(false);
  };

  const handleAvatarSelect = (avatar) => {
    setTempProfile({ ...tempProfile, avatar });
  };

  const handleBannerSelect = (banner) => {
    if (banner.unlocked) {
      setTempProfile({ ...tempProfile, banner });
    } else {
      toast({
        title: "Banner bloqueado",
        description: "Necesitas desbloquear este banner completando más actividades.",
        variant: "destructive",
      });
    }
  };

  const handleCustomAvatarUpload = (file) => {
    // Aquí se manejaría la subida del archivo al servidor
    console.log("Archivo subido:", file);
    toast({
      title: "Foto subida",
      description: "Tu foto personalizada ha sido subida exitosamente.",
    });
  };

  const toggleBadge = (badgeId) => {
    const currentBadges = tempProfile.selectedBadges;
    const isSelected = currentBadges.includes(badgeId);
    
    if (isSelected) {
      setTempProfile({
        ...tempProfile,
        selectedBadges: currentBadges.filter(id => id !== badgeId)
      });
    } else if (currentBadges.length < 3) {
      setTempProfile({
        ...tempProfile,
        selectedBadges: [...currentBadges, badgeId]
      });
    } else {
      toast({
        title: "Límite alcanzado",
        description: "Solo puedes mostrar 3 badges a la vez.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mi Perfil</h1>
            <p className="text-muted-foreground">
              Personaliza tu perfil y muestra tus logros
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Editar Perfil
              </Button>
            )}
          </div>
        </div>

        {/* Vista previa del perfil */}
        <Card className="relative overflow-hidden">
          <div 
            className="h-32 bg-gradient-to-r from-blue-400 to-purple-500"
            style={{
              backgroundImage: `url(${profile.banner.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <CardContent className="pt-0">
            <div className="flex items-end space-x-4 -mt-16 mb-4">
              <Avatar className="w-24 h-24 border-4 border-background">
                <AvatarImage src={profile.avatar.src} alt={profile.avatar.name} />
                <AvatarFallback className="text-2xl">
                  {profile.nickname.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{profile.nickname}</h2>
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            </div>
            
            {/* Badges seleccionados */}
            <div className="flex flex-wrap gap-2">
              {profile.selectedBadges.map(badgeId => {
                const badge = userBadges.find(b => b.id === badgeId);
                if (!badge) return null;
                const IconComponent = badge.icon;
                return (
                  <Badge key={badge.id} variant="secondary" className="flex items-center gap-1">
                    <IconComponent className="w-3 h-3" />
                    {badge.name}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs de personalización */}
        <Tabs defaultValue="avatar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="avatar">Avatar</TabsTrigger>
            <TabsTrigger value="banner">Banner</TabsTrigger>
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
          </TabsList>

          {/* Tab Avatar */}
          <TabsContent value="avatar" className="space-y-4">
            <AvatarSelector
              avatars={predefinedAvatars}
              selectedAvatar={tempProfile.avatar}
              onAvatarSelect={handleAvatarSelect}
              onCustomAvatarUpload={handleCustomAvatarUpload}
              disabled={!isEditing}
              nickname={tempProfile.nickname}
            />
          </TabsContent>

          {/* Tab Banner */}
          <TabsContent value="banner" className="space-y-4">
            <BannerSelector
              banners={profileBanners}
              selectedBanner={tempProfile.banner}
              onBannerSelect={handleBannerSelect}
              disabled={!isEditing}
            />
          </TabsContent>

          {/* Tab Información */}
          <TabsContent value="info" className="space-y-4">
            <ProfileInfo
              nickname={tempProfile.nickname}
              bio={tempProfile.bio}
              onNicknameChange={(nickname) => setTempProfile({ ...tempProfile, nickname })}
              onBioChange={(bio) => setTempProfile({ ...tempProfile, bio })}
              disabled={!isEditing}
            />
          </TabsContent>

          {/* Tab Badges */}
          <TabsContent value="badges" className="space-y-4">
            <BadgeSelector
              badges={userBadges}
              selectedBadges={tempProfile.selectedBadges}
              onBadgeToggle={toggleBadge}
              maxSelection={3}
              disabled={!isEditing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
