import { useState } from "react";
import { User, LogOut, Settings, Camera, X, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface UserProfile {
  avatar?: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
}

export const UserAccountDropdown = () => {
  const { user, logout, updateUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar);
  
  // Parse user name into first/last
  const nameParts = (user?.name || "Maria Rossi").split(" ");
  const [profile, setProfile] = useState<UserProfile>({
    avatar: user?.avatar,
    email: user?.email || "maria.rossi@fgb.com",
    firstName: nameParts[0] || "Maria",
    lastName: nameParts.slice(1).join(" ") || "Rossi",
    company: "FGB Group",
    role: "Energy Manager",
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setProfile(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    if (user) {
      updateUser(user.id, {
        name: `${profile.firstName} ${profile.lastName}`,
        email: profile.email,
        avatar: profile.avatar,
      });
    }
    setIsEditDialogOpen(false);
  };

  const getInitials = () => {
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 md:gap-3 glass-panel rounded-full px-3 md:px-4 py-1.5 md:py-2 cursor-pointer hover:bg-fgb-light/50 transition-colors">
            <span className="text-xs md:text-sm font-medium text-foreground hidden sm:block">
              {profile.firstName} {profile.lastName}
            </span>
            <Avatar className="w-7 h-7 md:w-9 md:h-9 border border-white/20">
              <AvatarImage src={avatarPreview} alt="Avatar" />
              <AvatarFallback className="bg-fgb-light text-foreground text-xs">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-4 bg-white shadow-xl rounded-xl border-0">
          {/* Profile Header */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-14 h-14 border-2 border-fgb-accent">
              <AvatarImage src={avatarPreview} alt="Avatar" />
              <AvatarFallback className="bg-fgb-light text-foreground text-lg font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{profile.firstName} {profile.lastName}</p>
              <p className="text-xs text-gray-500 truncate">{profile.email}</p>
              <p className="text-xs text-fgb-secondary font-medium">{profile.role}</p>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Azienda</span>
              <span className="text-gray-800 font-medium">{profile.company}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ruolo</span>
              <span className="text-gray-800 font-medium capitalize">{user?.role || "viewer"}</span>
            </div>
          </div>

          <DropdownMenuSeparator className="my-2" />

          {/* Actions */}
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-gray-700 hover:bg-gray-100"
              onClick={() => {
                setIsOpen(false);
                setIsEditDialogOpen(true);
              }}
            >
              <Settings className="w-4 h-4" />
              Modifica Profilo
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
            >
              <LogOut className="w-4 h-4" />
              Esci
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">Modifica Profilo</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-fgb-accent/20">
                  <AvatarImage src={avatarPreview} alt="Avatar" />
                  <AvatarFallback className="bg-fgb-light text-foreground text-2xl font-semibold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute bottom-0 right-0 w-8 h-8 bg-fgb-secondary text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-fgb-secondary/80 transition-colors shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <p className="text-xs text-gray-500">Clicca per caricare un'immagine</p>
            </div>

            {/* Form Fields */}
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@esempio.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName}
                    onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Nome"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName}
                    onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Cognome"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="company">Azienda</Label>
                <Input
                  id="company"
                  value={profile.company}
                  onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Nome azienda"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">Ruolo</Label>
                <Input
                  id="role"
                  value={profile.role}
                  onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Es. Energy Manager"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button onClick={handleSaveProfile} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
              <Save className="w-4 h-4 mr-2" />
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAccountDropdown;
