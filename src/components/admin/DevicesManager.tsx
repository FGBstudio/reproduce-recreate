import { useState, useEffect, useMemo } from 'react';
import { 
  Cpu, Search, ArrowRight, AlertTriangle, CheckCircle2, 
  XCircle, Clock, Filter, RefreshCw, Inbox, Zap, Wind, Droplets
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAdminData } from '@/contexts/AdminDataContext';
import { format } from 'date-fns';

// Constants
const INBOX_SITE_ID = '00000000-0000-0000-0000-000000000003';

interface Device {
  id: string;
  device_id: string;
  mac_address?: string;
  model?: string;
  device_type: string;
  name?: string;
  location?: string;
  status: string;
  last_seen?: string;
  site_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  sites?: {
    id: string;
    name: string;
    brand_id: string;
  };
}

interface Site {
  id: string;
  name: string;
  brand_id: string;
  brands?: {
    id: string;
    name: string;
    holding_id: string;
    holdings?: {
      id: string;
      name: string;
    };
  };
}

const deviceTypeIcons: Record<string, React.ReactNode> = {
  energy_monitor: <Zap className="w-4 h-4 text-yellow-500" />,
  air_quality: <Wind className="w-4 h-4 text-blue-500" />,
  water_meter: <Droplets className="w-4 h-4 text-cyan-500" />,
  other: <Cpu className="w-4 h-4 text-gray-500" />,
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  online: { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  offline: { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: <XCircle className="w-3 h-3" /> },
  warning: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <AlertTriangle className="w-3 h-3" /> },
  error: { color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  maintenance: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Clock className="w-3 h-3" /> },
};

export const DevicesManager = () => {
  const { toast } = useToast();
  const { refreshData: refreshAdminData } = useAdminData();
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showInboxOnly, setShowInboxOnly] = useState(true);
  
  // Move dialog state
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [targetSiteId, setTargetSiteId] = useState<string>('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceLocation, setNewDeviceLocation] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Fetch data
  const fetchData = async () => {
    if (!supabase || !isSupabaseConfigured) {
      // Mock data for development
      setDevices([
        {
          id: 'mock-1',
          device_id: 'WEEL0001',
          mac_address: 'AA:BB:CC:DD:EE:01',
          model: 'WEEL',
          device_type: 'air_quality',
          name: 'Auto: WEEL0001',
          status: 'online',
          last_seen: new Date().toISOString(),
          site_id: INBOX_SITE_ID,
          metadata: { auto_created: true },
          created_at: new Date().toISOString(),
        },
        {
          id: 'mock-2',
          device_id: 'PAN12-BRIDGE1',
          model: 'PAN12',
          device_type: 'energy_monitor',
          name: 'Auto: PAN12-BRIDGE1',
          status: 'online',
          last_seen: new Date().toISOString(),
          site_id: INBOX_SITE_ID,
          metadata: { auto_created: true, bridge_name: 'BRIDGE1' },
          created_at: new Date().toISOString(),
        },
        {
          id: 'mock-3',
          device_id: 'MSCHN-001',
          model: 'SCHNEIDER',
          device_type: 'energy_monitor',
          name: 'Schneider Meter 001',
          status: 'warning',
          last_seen: new Date(Date.now() - 3600000).toISOString(),
          site_id: 'site-1',
          metadata: {},
          created_at: new Date().toISOString(),
          sites: { id: 'site-1', name: 'Milan Flagship', brand_id: 'gucci' },
        },
      ]);
      setSites([
        { id: INBOX_SITE_ID, name: 'Inbox / Unassigned Devices', brand_id: 'system' },
        { id: 'site-1', name: 'Milan Flagship', brand_id: 'gucci', brands: { id: 'gucci', name: 'Gucci', holding_id: 'kering', holdings: { id: 'kering', name: 'Kering' } } },
        { id: 'site-2', name: 'Paris Flagship', brand_id: 'lv', brands: { id: 'lv', name: 'Louis Vuitton', holding_id: 'lvmh', holdings: { id: 'lvmh', name: 'LVMH' } } },
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch devices with site info
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select(`
          *,
          sites!inner(id, name, brand_id)
        `)
        .order('created_at', { ascending: false });

      if (devicesError) throw devicesError;
      setDevices(devicesData || []);

      // Fetch all sites with brand and holding info
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select(`
          *,
          brands!inner(
            id, name, holding_id,
            holdings!inner(id, name)
          )
        `)
        .neq('id', INBOX_SITE_ID)
        .order('name');

      if (sitesError) throw sitesError;
      setSites([
        { id: INBOX_SITE_ID, name: 'Inbox / Unassigned Devices', brand_id: 'system' },
        ...(sitesData || []),
      ]);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile caricare i dispositivi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter devices
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      // Inbox filter
      if (showInboxOnly && device.site_id !== INBOX_SITE_ID) return false;
      if (!showInboxOnly && device.site_id === INBOX_SITE_ID) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          device.device_id?.toLowerCase().includes(query) ||
          device.name?.toLowerCase().includes(query) ||
          device.mac_address?.toLowerCase().includes(query) ||
          device.model?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filterType !== 'all' && device.device_type !== filterType) return false;

      // Status filter
      if (filterStatus !== 'all' && device.status !== filterStatus) return false;

      return true;
    });
  }, [devices, showInboxOnly, searchQuery, filterType, filterStatus]);

  // Inbox count
  const inboxCount = devices.filter(d => d.site_id === INBOX_SITE_ID).length;

  // Handle device selection
  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const toggleAllDevices = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
    }
  };

  // Move devices to site
  const handleMoveDevices = async () => {
    if (!targetSiteId || selectedDevices.size === 0) return;

    setIsMoving(true);
    try {
      if (!supabase || !isSupabaseConfigured) {
        // Mock move
        setDevices(prev => prev.map(d => 
          selectedDevices.has(d.id) 
            ? { ...d, site_id: targetSiteId, name: newDeviceName || d.name, location: newDeviceLocation || d.location }
            : d
        ));
        toast({
          title: 'Dispositivi spostati',
          description: `${selectedDevices.size} dispositivo/i spostato/i con successo`,
        });
      } else {
        const updates: Partial<Device> = { site_id: targetSiteId };
        if (newDeviceName) updates.name = newDeviceName;
        if (newDeviceLocation) updates.location = newDeviceLocation;

        const { error } = await supabase
          .from('devices')
          .update(updates)
          .in('id', Array.from(selectedDevices));

        if (error) throw error;

        toast({
          title: 'Dispositivi spostati',
          description: `${selectedDevices.size} dispositivo/i spostato/i con successo. Moduli attivati automaticamente.`,
        });

        // Refresh devices list
        await fetchData();
        
        // Refresh admin data to pick up auto-enabled modules
        await refreshAdminData();
      }

      setSelectedDevices(new Set());
      setIsMoveDialogOpen(false);
      setTargetSiteId('');
      setNewDeviceName('');
      setNewDeviceLocation('');
    } catch (error) {
      console.error('Error moving devices:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile spostare i dispositivi',
        variant: 'destructive',
      });
    } finally {
      setIsMoving(false);
    }
  };

  // Group sites by holding/brand for select
  const groupedSites = useMemo(() => {
    const groups: Record<string, { holding: string; brand: string; sites: Site[] }> = {};
    
    sites.filter(s => s.id !== INBOX_SITE_ID).forEach(site => {
      const holdingName = site.brands?.holdings?.name || 'Unknown';
      const brandName = site.brands?.name || 'Unknown';
      const key = `${holdingName}-${brandName}`;
      
      if (!groups[key]) {
        groups[key] = { holding: holdingName, brand: brandName, sites: [] };
      }
      groups[key].sites.push(site);
    });

    return Object.values(groups).sort((a, b) => 
      a.holding.localeCompare(b.holding) || a.brand.localeCompare(b.brand)
    );
  }, [sites]);

  const getDeviceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      energy_monitor: 'Energy',
      air_quality: 'Air Quality',
      water_meter: 'Water',
      occupancy: 'Occupancy',
      hvac: 'HVAC',
      lighting: 'Lighting',
      other: 'Other',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Cpu className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Device Mapping</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gestisci e assegna i dispositivi ai progetti
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Inbox className="w-3.5 h-3.5" />
              {inboxCount} in Inbox
            </Badge>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Filters Row */}
        <div className="flex flex-wrap gap-3">
          {/* Inbox Toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={showInboxOnly ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowInboxOnly(true)}
              className="rounded-none"
            >
              <Inbox className="w-4 h-4 mr-1.5" />
              Inbox ({inboxCount})
            </Button>
            <Button
              variant={!showInboxOnly ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowInboxOnly(false)}
              className="rounded-none"
            >
              Assegnati ({devices.length - inboxCount})
            </Button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per ID, nome, MAC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="energy_monitor">Energy</SelectItem>
              <SelectItem value="air_quality">Air Quality</SelectItem>
              <SelectItem value="water_meter">Water</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Bar */}
        {selectedDevices.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedDevices.size} dispositivo/i selezionato/i
            </span>
            <Button size="sm" onClick={() => setIsMoveDialogOpen(true)}>
              <ArrowRight className="w-4 h-4 mr-1.5" />
              Sposta a Site
            </Button>
          </div>
        )}

        {/* Devices Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0}
                    onCheckedChange={toggleAllDevices}
                  />
                </TableHead>
                <TableHead>Device ID</TableHead>
                <TableHead>Modello</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Ultima connessione</TableHead>
                {!showInboxOnly && <TableHead>Site</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={showInboxOnly ? 7 : 8} className="text-center py-10 text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showInboxOnly ? 7 : 8} className="text-center py-10 text-muted-foreground">
                    {showInboxOnly ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="font-medium">Nessun dispositivo in Inbox</p>
                        <p className="text-sm">Tutti i dispositivi sono stati assegnati</p>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-8 h-8 mx-auto mb-2" />
                        <p className="font-medium">Nessun dispositivo trovato</p>
                        <p className="text-sm">Modifica i filtri per vedere altri dispositivi</p>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => {
                  const status = statusConfig[device.status] || statusConfig.offline;
                  return (
                    <TableRow 
                      key={device.id} 
                      className={selectedDevices.has(device.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={() => toggleDeviceSelection(device.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {device.device_id}
                        {device.mac_address && (
                          <span className="block text-xs text-muted-foreground">
                            {device.mac_address}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {device.model || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {deviceTypeIcons[device.device_type] || deviceTypeIcons.other}
                          <span className="text-sm">{getDeviceTypeLabel(device.device_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{device.name || '-'}</span>
                        {device.location && (
                          <span className="block text-xs text-muted-foreground">{device.location}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${status.color}`}>
                          {status.icon}
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {device.last_seen 
                          ? format(new Date(device.last_seen), 'dd/MM/yyyy HH:mm')
                          : '-'
                        }
                      </TableCell>
                      {!showInboxOnly && (
                        <TableCell className="text-sm">
                          {device.sites?.name || '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sposta Dispositivi</DialogTitle>
            <DialogDescription>
              Sposta {selectedDevices.size} dispositivo/i selezionato/i in un nuovo site
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Site di destinazione *</Label>
              <Select value={targetSiteId} onValueChange={setTargetSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un site" />
                </SelectTrigger>
                <SelectContent>
                  {groupedSites.map((group) => (
                    <div key={`${group.holding}-${group.brand}`}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {group.holding} → {group.brand}
                      </div>
                      {group.sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDevices.size === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Nome dispositivo (opzionale)</Label>
                  <Input
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="Es. Sensore Piano Terra"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Posizione (opzionale)</Label>
                  <Input
                    value={newDeviceLocation}
                    onChange={(e) => setNewDeviceLocation(e.target.value)}
                    placeholder="Es. Ingresso principale"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleMoveDevices} disabled={!targetSiteId || isMoving}>
              {isMoving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Spostamento...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Sposta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
