import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Tag, MapPin, FolderKanban, Users, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HoldingsManager } from '@/components/admin/HoldingsManager';
import { BrandsManager } from '@/components/admin/BrandsManager';
import { SitesManager } from '@/components/admin/SitesManager';
import { ProjectsManager } from '@/components/admin/ProjectsManager';
import { UserAccessManager } from '@/components/admin/UserAccessManager';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('holdings');

  return (
    <AdminAuthGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
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
                <span className="text-sm text-slate-500">
                  {user?.name}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-fgb-secondary/10 text-fgb-secondary rounded-full">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid bg-white shadow-sm">
              <TabsTrigger value="holdings" className="gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Holdings</span>
              </TabsTrigger>
              <TabsTrigger value="brands" className="gap-2">
                <Tag className="w-4 h-4" />
                <span className="hidden sm:inline">Brands</span>
              </TabsTrigger>
              <TabsTrigger value="sites" className="gap-2">
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Sites</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <FolderKanban className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </TabsTrigger>
              <TabsTrigger value="access" className="gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Access</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="holdings">
              <HoldingsManager />
            </TabsContent>
            
            <TabsContent value="brands">
              <BrandsManager />
            </TabsContent>
            
            <TabsContent value="sites">
              <SitesManager />
            </TabsContent>
            
            <TabsContent value="projects">
              <ProjectsManager />
            </TabsContent>
            
            <TabsContent value="access">
              <UserAccessManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AdminAuthGate>
  );
};

export default Admin;
