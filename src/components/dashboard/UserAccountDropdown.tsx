import { useState, useEffect } from "react";
import { LogOut, Settings, Camera, X, Save, Loader2, Sun, Moon, ShieldCheck, Bell, HelpCircle, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUserAlerts } from "@/hooks/useUserAlerts";
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
import { NotificationsTab } from "./NotificationsTab";
import { HelpTab } from "./HelpTab";
import { cn } from "@/lib/utils";

type TabKey = "profile" | "alerts" | "help";

export const UserAccountDropdown = () => {
  const { user, profile, logout, updateProfile, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { unreadCount } = useUserAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
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

  // Reset to profile tab when panel closes
  useEffect(() => {
    if (!isOpen) setActiveTab("profile");
  }, [isOpen]);

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
    }
    
    setIsSaving(false);
    setIsEditDialogOpen(false);
  };

  const displayName = formData.display_name || `${formData.first_name} ${formData.last_name}`.trim() || user?.name || 'User';
  const initials = displayName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);

  const hasUnread = unreadCount > 0;

  const tabs: { key: TabKey; icon: typeof UserIcon; label: string; badge?: number }[] = [
    { key: "profile", icon: UserIcon, label: t('account.edit_profile') ? "Profile" : "Profile" },
    { key: "alerts", icon: Bell, label: "Alerts", badge: unreadCount },
    { key: "help", icon: HelpCircle, label: "Help" },
  ];

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            data-tour="profile-button"
            className="flex items-center gap-2 md:gap-3 glass-panel rounded-full px-3 md:px-4 py-1.5 md:py-2 cursor-pointer hover:bg-fgb-light/50 transition-colors"
          >
            <span className="text-xs md:text-sm font-medium text-foreground hidden sm:block">
              {displayName}
            </span>
            <div className="relative">
              <Avatar className="w-7 h-7 md:w-9 md:h-9 border border-white/20">
                <AvatarImage src={avatarPreview} alt="Avatar" />
                <AvatarFallback className="bg-fgb-light text-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {hasUnread && !isOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[hsl(var(--rose))] ring-2 ring-background shadow-[0_0_8px_hsl(var(--rose)/0.6)]" />
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[360px] p-0 bg-[hsl(var(--popover))] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* === Header: avatar + identity === */}
          <div className="p-4 flex items-start gap-3">
            <Avatar className="w-14 h-14 border-2 border-[hsl(var(--fgb-accent))]/30">
              <AvatarImage src={avatarPreview} alt="Avatar" />
              <AvatarFallback className="bg-[hsl(var(--fgb-light))] text-foreground text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate text-sm">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{formData.email}</p>
              {formData.company && (
                <p className="text-[11px] text-muted-foreground/80 truncate">{formData.company}</p>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setIsOpen(false); navigate('/admin'); }}
                  className="mt-1.5 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[hsl(var(--fgb-accent))]/15 text-[10px] font-semibold text-[hsl(var(--fgb-accent))] hover:bg-[hsl(var(--fgb-accent))]/25 transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  Admin · {t('account.system_role') || 'Open panel'}
                </button>
              )}
            </div>
          </div>

          {/* === Theme toggle === */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] text-muted-foreground px-2">Theme</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
                    theme === 'light'
                      ? "bg-[hsl(var(--fgb-accent))] text-[hsl(var(--fgb-base))]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sun className="w-3 h-3" /> Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
                    theme === 'dark'
                      ? "bg-[hsl(var(--fgb-accent))] text-[hsl(var(--fgb-base))]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Moon className="w-3 h-3" /> Dark
                </button>
              </div>
            </div>
          </div>

          {/* === Tabs === */}
          <div className="px-4 border-b border-white/5">
            <div className="relative flex items-center gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {tab.badge && tab.badge > 0 ? (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[hsl(var(--rose))] text-white text-[9px] font-semibold">
                        {tab.badge}
                      </span>
                    ) : null}
                    {isActive && (
                      <motion.div
                        layoutId="tab-underline"
                        className="absolute -bottom-px left-0 right-0 h-px bg-[hsl(var(--fgb-accent))]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* === Tab content === */}
          <div className="p-4 min-h-[200px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === 'profile' && (
                  <div className="space-y-2">
                    {formData.job_title && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t('account.role') || 'Role'}</span>
                        <span className="text-foreground font-medium">{formData.job_title}</span>
                      </div>
                    )}
                    {formData.phone && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t('account.phone') || 'Phone'}</span>
                        <span className="text-foreground font-medium">{formData.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('account.system_role') || 'System role'}</span>
                      <span className="text-foreground font-medium capitalize">{user?.role || 'viewer'}</span>
                    </div>
                  </div>
                )}
                {activeTab === 'alerts' && <NotificationsTab />}
                {activeTab === 'help' && <HelpTab />}
              </motion.div>
            </AnimatePresence>
          </div>

          <DropdownMenuSeparator className="my-0 bg-white/5" />

          {/* === Footer actions === */}
          <div className="p-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-center gap-1.5 text-xs h-9 text-foreground/80 hover:bg-white/5"
              onClick={() => { setIsOpen(false); setIsEditDialogOpen(true); }}
            >
              <Settings className="w-3.5 h-3.5" />
              {t('account.edit_profile') || 'Edit profile'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-center gap-1.5 text-xs h-9 text-[hsl(var(--rose))] hover:bg-[hsl(var(--rose))]/10"
              onClick={() => { logout(); setIsOpen(false); }}
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('account.logout') || 'Sign out'}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-800">{t('account.edit_profile')}</DialogTitle>
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
              <p className="text-xs text-gray-500">{t('account.click_upload')}</p>
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
                  placeholder={t('account.email_placeholder')}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">{t('account.first_name')}</Label>
                  <Input
                    id="firstName"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t('account.first_name_placeholder')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">{t('account.last_name')}</Label>
                  <Input
                    id="lastName"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t('account.last_name_placeholder')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="company">{t('account.company')}</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder={t('account.company_placeholder')}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="jobTitle">{t('account.role')}</Label>
                  <Input
                    id="jobTitle"
                    value={formData.job_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                    placeholder={t('account.role_placeholder')}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">{t('account.phone')}</Label>
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
              {t('account.cancel')}
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
              {t('account.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserAccountDropdown;
