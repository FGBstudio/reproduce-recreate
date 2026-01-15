import { useState, useEffect } from "react";
import { User, LogOut, Settings, Camera, X, Save, Loader2 } from "lucide-react";
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
import { isSupabaseConfigured } from "@/lib/supabase";

export const UserAccountDropdown = () => {
  const { user, profile, logout, updateUser, updateProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar);
  
  // Local form state
  const [formData, setFormData] = useState({
    avatar_url: profile?.avatar_url || user?.avatar || '',
    email: profile?.email || user?.email || '',
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    display_name: profile?.display_name || user?.name || '',
    company: profile?.company || '',
    job_title: profile?.job_title || '',
    phone: profile?.phone || '',
  });

  // Update form when profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        avatar_url: profile.avatar_url || '',
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        company: profile.company || '',
        job_title: profile.job_title || '',
        phone: profile.phone || '',
      });
      setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setFormData(prev => ({ ...prev, avatar_url: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    if (isSupabaseConfigured) {
      // Save to Supabase
      const { error } = await updateProfile({
        avatar_url: formData.avatar_url,
        first_name: formData.first_name,
        last_name: formData.last_name,
        display_name: formData.display_name || `${formData.first_name} ${formData.last_name}`.trim(),
        company: formData.company,
        job_title: formData.job_title,
        phone: formData.phone,
      });
      
      if (error) {
        console.error('Error saving profile:', error);
      }
    } else {
      // Mock update
      updateUser(user.id, {
        name: formData.display_name || `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        avatar: formData.avatar_url,
      });
    }
    
    setIsSaving(false);
    setIsEditDialogOpen(false);
  };

  const displayName = formData.display_name || `${formData.first_name} ${formData.last_name}`.trim() || user?.name || 'User';
  const initials = displayName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 md:gap-3 glass-panel rounded-full px-3 md:px-4 py-1.5 md:py-2 cursor-pointer hover:bg-fgb-light/50 transition-colors">
            <span className="text-xs md:text-sm font-medium text-foreground hidden sm:block">
              {displayName}
            </span>
            <Avatar className="w-7 h-7 md:w-9 md:h-9 border border-white/20">
              <AvatarImage src={avatarPreview} alt="Avatar" />
              <AvatarFallback className="bg-fgb-light text-foreground text-xs">
                {initials}
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
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{formData.email}</p>
              <p className="text-xs text-fgb-secondary font-medium">{formData.job_title || user?.role}</p>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-2 mb-4">
            {formData.company && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Azienda</span>
                <span className="text-gray-800 font-medium">{formData.company}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ruolo Sistema</span>
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
                    {initials}
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
                  value={formData.email}
                  disabled={isSupabaseConfigured} // Email can't be changed when using Supabase Auth
                  className={isSupabaseConfigured ? 'bg-gray-50' : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@esempio.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Nome"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input
                    id="lastName"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Cognome"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="company">Azienda</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Nome azienda"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jobTitle">Ruolo</Label>
                  <Input
                    id="jobTitle"
                    value={formData.job_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                    placeholder="Es. Energy Manager"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+39 123 456 7890"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              <X className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button 
              onClick={handleSaveProfile} 
              className="bg-fgb-secondary hover:bg-fgb-secondary/90"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAccountDropdown;
