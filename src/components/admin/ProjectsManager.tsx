import { useState } from 'react';
import { Plus, Pencil, Trash2, FolderKanban, MapPin, Zap, Wind, Droplet, Award, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { AdminProject, CertificationType, defaultProjectModules, ModuleType } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const certificationOptions: CertificationType[] = ['LEED', 'BREEAM', 'WELL', 'ENERGY_AUDIT', 'ISO_14001', 'ISO_50001'];

const moduleIcons: Record<ModuleType, React.ReactNode> = {
  energy: <Zap className="w-4 h-4" />,
  air: <Wind className="w-4 h-4" />,
  water: <Droplet className="w-4 h-4" />,
};

const moduleLabels: Record<ModuleType, string> = {
  energy: 'Energy',
  air: 'Air Quality',
  water: 'Water',
};

export const ProjectsManager = () => {
  const { sites, projects, addProject, updateProject, deleteProject } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);
  const [formData, setFormData] = useState<Omit<AdminProject, 'id' | 'createdAt' | 'updatedAt'>>({
    siteId: '',
    name: '',
    status: 'active',
    modules: JSON.parse(JSON.stringify(defaultProjectModules)),
    certifications: [],
  });

  const handleOpenCreate = () => {
    setEditingProject(null);
    setFormData({
      siteId: sites[0]?.id || '',
      name: '',
      status: 'active',
      modules: JSON.parse(JSON.stringify(defaultProjectModules)),
      certifications: [],
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (project: AdminProject) => {
    setEditingProject(project);
    setFormData({
      siteId: project.siteId,
      name: project.name,
      status: project.status,
      modules: JSON.parse(JSON.stringify(project.modules)),
      certifications: [...project.certifications],
    });
    setIsDialogOpen(true);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProject) {
        await updateProject(editingProject.id, formData);
      } else {
        await addProject(formData);
      }
      setIsDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCertification = (cert: CertificationType) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert]
    }));
  };

  const updateModuleConfig = (module: ModuleType, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [module]: {
          ...prev.modules[module],
          [field]: value,
        },
      },
    }));
  };

  const updateModuleLockCopy = (module: ModuleType, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [module]: {
          ...prev.modules[module],
          lockCopy: {
            ...prev.modules[module].lockCopy,
            [field]: value,
          },
        },
      },
    }));
  };

  const getSiteName = (siteId: string) => sites.find(s => s.id === siteId)?.name || 'N/A';

  const getModuleStatus = (project: AdminProject, module: ModuleType) => {
    const config = project.modules[module];
    if (config.enabled) return { label: 'Attivo', color: 'bg-green-100 text-green-700' };
    if (config.showDemo) return { label: 'Demo', color: 'bg-purple-100 text-purple-700' };
    return { label: 'Off', color: 'bg-gray-100 text-gray-500' };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5" />
              Projects
            </CardTitle>
            <CardDescription>
              Gestisci i progetti IoT, moduli attivi e certificazioni
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Progetto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingProject ? 'Modifica Progetto' : 'Nuovo Progetto'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[65vh] pr-4">
                  <Tabs defaultValue="general" className="mt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="general">Generale</TabsTrigger>
                      <TabsTrigger value="energy">Energy</TabsTrigger>
                      <TabsTrigger value="air">Air</TabsTrigger>
                      <TabsTrigger value="water">Water</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Site *</Label>
                          <Select
                            value={formData.siteId}
                            onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona site" />
                            </SelectTrigger>
                            <SelectContent>
                              {sites.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Stato</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value) => setFormData({ ...formData, status: value as 'active' | 'inactive' | 'pending' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Nome Progetto *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Es. Gucci Milan IoT Monitoring"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Certificazioni</Label>
                        <div className="flex flex-wrap gap-2">
                          {certificationOptions.map(cert => (
                            <label
                              key={cert}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                                formData.certifications.includes(cert)
                                  ? 'bg-fgb-secondary/10 border-fgb-secondary text-fgb-secondary'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Checkbox
                                checked={formData.certifications.includes(cert)}
                                onCheckedChange={() => toggleCertification(cert)}
                                className="hidden"
                              />
                              <Award className="w-3.5 h-3.5" />
                              <span className="text-sm">{cert}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    {(['energy', 'air', 'water'] as ModuleType[]).map(module => (
                      <TabsContent key={module} value={module} className="space-y-4 mt-4">
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            {moduleIcons[module]}
                            <span className="font-medium">{moduleLabels[module]}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <Label className="text-sm text-slate-600">Attivo</Label>
                            <Switch
                              checked={formData.modules[module].enabled}
                              onCheckedChange={(checked) => updateModuleConfig(module, 'enabled', checked)}
                            />
                          </div>
                        </div>

                        {!formData.modules[module].enabled && (
                          <>
                            <div className="flex items-center gap-4 p-3 bg-purple-50 rounded-lg">
                              <Eye className="w-4 h-4 text-purple-600" />
                              <span className="text-sm text-purple-700">Mostra dati demo</span>
                              <Switch
                                checked={formData.modules[module].showDemo}
                                onCheckedChange={(checked) => updateModuleConfig(module, 'showDemo', checked)}
                                className="ml-auto"
                              />
                            </div>

                            <div className="border rounded-lg p-4 space-y-3">
                              <Label className="text-sm font-medium">Messaggio Modulo Bloccato</Label>
                              <div className="grid gap-3">
                                <div className="grid gap-1.5">
                                  <Label className="text-xs text-slate-500">Titolo</Label>
                                  <Input
                                    value={formData.modules[module].lockCopy.title}
                                    onChange={(e) => updateModuleLockCopy(module, 'title', e.target.value)}
                                    placeholder="Modulo Non Attivo"
                                  />
                                </div>
                                <div className="grid gap-1.5">
                                  <Label className="text-xs text-slate-500">Descrizione</Label>
                                  <Textarea
                                    value={formData.modules[module].lockCopy.description}
                                    onChange={(e) => updateModuleLockCopy(module, 'description', e.target.value)}
                                    rows={2}
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="grid gap-1.5">
                                    <Label className="text-xs text-slate-500">CTA Label</Label>
                                    <Input
                                      value={formData.modules[module].lockCopy.ctaLabel}
                                      onChange={(e) => updateModuleLockCopy(module, 'ctaLabel', e.target.value)}
                                    />
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label className="text-xs text-slate-500">CTA Tipo</Label>
                                    <Select
                                      value={formData.modules[module].lockCopy.ctaType}
                                      onValueChange={(v) => updateModuleLockCopy(module, 'ctaType', v)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="link">Link</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-1.5">
                                    <Label className="text-xs text-slate-500">CTA Value</Label>
                                    <Input
                                      value={formData.modules[module].lockCopy.ctaValue}
                                      onChange={(e) => updateModuleLockCopy(module, 'ctaValue', e.target.value)}
                                      placeholder="email@domain.com"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                </ScrollArea>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                    {editingProject ? 'Salva' : 'Crea'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Moduli</TableHead>
              <TableHead>Certificazioni</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs">
                    <MapPin className="w-3 h-3" />
                    {getSiteName(project.siteId)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {(['energy', 'air', 'water'] as ModuleType[]).map(module => {
                      const status = getModuleStatus(project, module);
                      return (
                        <span
                          key={module}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${status.color}`}
                          title={`${moduleLabels[module]}: ${status.label}`}
                        >
                          {moduleIcons[module]}
                        </span>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {project.certifications.length > 0 ? (
                      project.certifications.map(cert => (
                        <span key={cert} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                          {cert}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(project)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina Progetto</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare "{project.name}"?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteProject(project.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  Nessun progetto presente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
