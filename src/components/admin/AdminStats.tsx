import { useState, useEffect } from 'react';
import { Building2, Tag, MapPin, FolderKanban, Users, Zap, Wind, Droplet, TrendingUp, AlertTriangle, Cpu, Inbox } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { User } from '@/lib/types/admin';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const INBOX_SITE_ID = '00000000-0000-0000-0000-000000000003';

interface AdminStatsProps {
  users: User[];
}

export const AdminStats = ({ users }: AdminStatsProps) => {
  const { holdings, brands, sites, projects, memberships, loading } = useAdminData();
  const [deviceStats, setDeviceStats] = useState({ total: 0, inbox: 0, online: 0 });

  // Fetch device counts
  useEffect(() => {
    const fetchDeviceStats = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      
      try {
        // Total devices
        const { count: totalCount } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true });
        
        // Inbox devices
        const { count: inboxCount } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', INBOX_SITE_ID);
        
        // Online devices
        const { count: onlineCount } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'online');
        
        setDeviceStats({
          total: totalCount || 0,
          inbox: inboxCount || 0,
          online: onlineCount || 0,
        });
      } catch (error) {
        console.error('Error fetching device stats:', error);
      }
    };

    fetchDeviceStats();
  }, []);

  // Calculate module stats
  const moduleStats = projects.reduce(
    (acc, project) => {
      if (project.modules.energy.enabled) acc.energy++;
      if (project.modules.air.enabled) acc.air++;
      if (project.modules.water.enabled) acc.water++;
      return acc;
    },
    { energy: 0, air: 0, water: 0 }
  );

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const pendingProjects = projects.filter(p => p.status === 'pending').length;

  const stats = [
    { 
      icon: Building2, 
      label: 'Holdings', 
      value: holdings.length, 
      color: 'bg-slate-100 text-slate-700' 
    },
    { 
      icon: Tag, 
      label: 'Brands', 
      value: brands.length, 
      color: 'bg-purple-100 text-purple-700' 
    },
    { 
      icon: MapPin, 
      label: 'Sites', 
      value: sites.length, 
      color: 'bg-blue-100 text-blue-700' 
    },
    { 
      icon: FolderKanban, 
      label: 'Progetti', 
      value: projects.length, 
      sublabel: `${activeProjects} attivi`,
      color: 'bg-green-100 text-green-700' 
    },
    { 
      icon: Cpu, 
      label: 'Devices', 
      value: deviceStats.total, 
      sublabel: `${deviceStats.online} online`,
      color: 'bg-cyan-100 text-cyan-700' 
    },
    { 
      icon: Users, 
      label: 'Utenti', 
      value: users.length, 
      sublabel: `${memberships.length} accessi`,
      color: 'bg-orange-100 text-orange-700' 
    },
  ];

  const moduleStatItems = [
    { icon: Zap, label: 'Energy', value: moduleStats.energy, total: projects.length, color: 'text-amber-500 bg-amber-50' },
    { icon: Wind, label: 'Air', value: moduleStats.air, total: projects.length, color: 'text-blue-500 bg-blue-50' },
    { icon: Droplet, label: 'Water', value: moduleStats.water, total: projects.length, color: 'text-cyan-500 bg-cyan-50' },
  ];

  return (
    <div className="space-y-4">
      {/* Main stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                <div className="text-xs text-slate-500">{stat.label}</div>
                {stat.sublabel && (
                  <div className="text-[10px] text-slate-400">{stat.sublabel}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Module activation stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Attivazione Moduli</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {moduleStatItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center`}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{item.label}</span>
                  <span className="text-xs font-medium text-slate-800">{item.value}/{item.total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color.replace('text-', 'bg-').replace('-50', '-400')}`}
                    style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending alerts */}
      {pendingProjects > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-amber-800">
              {pendingProjects} {pendingProjects === 1 ? 'progetto' : 'progetti'} in attesa
            </div>
            <div className="text-xs text-amber-600">Richiede revisione e attivazione</div>
          </div>
        </div>
      )}
    </div>
  );
};
