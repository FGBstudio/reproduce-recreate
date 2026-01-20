import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Tag, MapPin, FolderKanban, Users, Shield, GitBranch, UserCog, LayoutDashboard, Cpu, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HoldingsManager } from '@/components/admin/HoldingsManager';
import { BrandsManager } from '@/components/admin/BrandsManager';
import { SitesManager } from '@/components/admin/SitesManager';
import { ProjectsManager } from '@/components/admin/ProjectsManager';
import { UserAccessManager } from '@/components/admin/UserAccessManager';
import { ClientUsersManager } from '@/components/admin/ClientUsersManager';
import { UsersManager } from '@/components/admin/UsersManager';
import { RolesManager } from '@/components/admin/RolesManager';
import { HierarchyView } from '@/components/admin/HierarchyView';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { DevicesManager } from '@/components/admin/DevicesManager';

const Admin = () => {
  const navigate = useNavigate();
  const { user, users, addUser, updateUser, deleteUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // QUESTA è la "magia" per la barra dedicata:
  // - flex-1: occupa tutto lo spazio verticale disponibile
  // - overflow-y-auto: se il contenuto è troppo lungo, metti QUI la scrollbar
  // - h-full: forza l'altezza massima
  const contentTabClass = "flex-1 overflow-y-auto h-full p-1 pb-32"; 

  return (
    <AdminAuthGate>
      {/* 1. Blocchiamo l'altezza della pagina a quella dello schermo (h-screen) */}
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        
        {/* Header fisso (non scrolla) */}
        <header className="flex-shrink-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                <div className="h-6 w-px bg-slate-200" />
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-fgb-secondary" />
                  <h1 className="text-lg font-bold text-slate-800">Admin Console</h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 hidden sm:inline">
                  {user?.name}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-fgb-secondary/10 text-fgb-secondary rounded-full">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Container principale (si adatta allo spazio rimasto) */}
        <main className="flex-1 flex flex-col overflow-hidden w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          
          {/* Tabs container: anche lui deve essere flex verticale per spingere giù il contenuto */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full space-y-4">
            
            {/* Menu Tab Fisso in alto */}
            <div className="flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-1.5">
              <TabsList className="grid w-full grid-cols-6 lg:grid-cols-11 gap-1 bg-transparent h-auto p-0">
                <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <LayoutDashboard className="w-4 h-4" /> <span className="hidden lg:inline">Dashboard</span>
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <GitBranch className="w-4 h-4" /> <span className="hidden lg:inline">Gerarchia</span>
                </TabsTrigger>
                <TabsTrigger value="holdings" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <Building2 className="w-4 h-4" /> <span className="hidden lg:inline">Holdings</span>
                </TabsTrigger>
                <TabsTrigger value="brands" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <Tag className="w-4 h-4" /> <span className="hidden lg:inline">Brands</span>
                </TabsTrigger>
                <TabsTrigger value="sites" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <MapPin className="w-4 h-4" /> <span className="hidden lg:inline">Sites</span>
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <FolderKanban className="w-4 h-4" /> <span className="hidden lg:inline">Projects</span>
                </TabsTrigger>
                <TabsTrigger value="devices" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <Cpu className="w-4 h-4" /> <span className="hidden lg:inline">Devices</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <UserCog className="w-4 h-4" /> <span className="hidden lg:inline">Utenti</span>
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <Shield className="w-4 h-4" /> <span className="hidden lg:inline">Ruoli</span>
                </TabsTrigger>
                <TabsTrigger value="client-users" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <UserPlus className="w-4 h-4" /> <span className="hidden lg:inline">Client</span>
                </TabsTrigger>
                <TabsTrigger value="access" className="gap-1.5 data-[state=active]:bg-fgb-secondary data-[state=active]:text-white rounded-lg py-2.5">
                  <Users className="w-4 h-4" /> <span className="hidden lg:inline">Accessi</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Aree Scrollabili con Barra Dedicata */}
            
            <TabsContent value="dashboard" className={contentTabClass}>
              <AdminStats users={users} />
              <div className="grid lg:grid-cols-2 gap-6 mt-6">
                <HierarchyView />
                <div className="space-y-6">
                  <UsersManager 
                    users={users}
                    onAddUser={addUser}
                    onUpdateUser={updateUser}
                    onDeleteUser={deleteUser}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hierarchy" className={contentTabClass}>
              <HierarchyView />
            </TabsContent>

            <TabsContent value="holdings" className={contentTabClass}>
              <HoldingsManager />
            </TabsContent>
            
            <TabsContent value="brands" className={contentTabClass}>
              <BrandsManager />
            </TabsContent>
            
            <TabsContent value="sites" className={contentTabClass}>
              <SitesManager />
            </TabsContent>
            
            <TabsContent value="projects" className={contentTabClass}>
              <ProjectsManager />
            </TabsContent>

            <TabsContent value="devices" className={contentTabClass}>
              <DevicesManager />
            </TabsContent>

            <TabsContent value="users" className={contentTabClass}>
              <UsersManager 
                users={users}
                onAddUser={addUser}
                onUpdateUser={updateUser}
                onDeleteUser={deleteUser}
              />
            </TabsContent>

            <TabsContent value="roles" className={contentTabClass}>
              <RolesManager />
            </TabsContent>

            <TabsContent value="client-users" className={contentTabClass}>
              <ClientUsersManager />
            </TabsContent>
            
            <TabsContent value="access" className={contentTabClass}>
              <UserAccessManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminAuthGate>
  );
};

export default Admin;
