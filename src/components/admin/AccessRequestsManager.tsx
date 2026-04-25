import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Search, Building2, Mail, MessageSquare, User } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AccessRequest {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export const AccessRequestsManager = () => {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = async () => {
    if (!isSupabaseConfigured) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      let query = supabase
        .from('access_requests')
        .select('id, first_name, last_name, email, company, job_title, message, status, created_at, reviewed_at, review_notes')
        .order('created_at', { ascending: false });
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching access requests:', error);
      toast.error('Errore nel caricamento delle richieste');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [filterStatus]);

  const handleReview = async (requestId: string, action: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: action,
          review_notes: reviewNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      if (action === 'approved' && selectedRequest) {
        // When approving, the admin will then manually invite the user
        // via the existing ClientUsersManager or edge function
        toast.success(`Richiesta di ${selectedRequest.first_name} ${selectedRequest.last_name} approvata. Procedi con l'invito dell'utente.`);
      } else {
        toast.success(`Richiesta ${action === 'approved' ? 'approvata' : 'rifiutata'}`);
      }

      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
    } catch (error: any) {
      console.error('Error reviewing request:', error);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1"><Clock className="w-3 h-3" />{t('admin.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle className="w-3 h-3" />{t('admin.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" />{t('admin.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const filteredRequests = requests.filter(r =>
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('admin.access_requests')}
                {pendingCount > 0 && (
                  <Badge className="bg-yellow-500 text-white ml-2">{pendingCount}</Badge>
                )}
              </CardTitle>
              <CardDescription>{t('admin.access_requests_desc')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchRequests} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Ricarica
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cerca per nome, email, azienda..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                <Button key={status} variant={filterStatus === status ? 'default' : 'outline'} size="sm"
                  onClick={() => setFilterStatus(status)}
                  className={filterStatus === status ? 'bg-fgb-secondary hover:bg-fgb-secondary/90' : ''}>
                  {status === 'all' ? 'Tutte' : t(`admin.${status}`)}
                </Button>
              ))}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Azienda</TableHead>
                <TableHead>Messaggio</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t('admin.no_requests')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.first_name} {req.last_name}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{req.company}</p>
                        {req.job_title && <p className="text-xs text-muted-foreground">{req.job_title}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm text-muted-foreground truncate">{req.message || '-'}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50"
                            onClick={() => { setSelectedRequest(req); setReviewNotes(''); }}>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {t('admin.approve')}
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
                            onClick={() => handleReview(req.id, 'rejected')}>
                            <XCircle className="w-4 h-4 mr-1" />
                            {t('admin.reject')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {req.reviewed_at && new Date(req.reviewed_at).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Approva Richiesta di Accesso</DialogTitle>
            <DialogDescription>
              Stai per approvare la richiesta di {selectedRequest?.first_name} {selectedRequest?.last_name} ({selectedRequest?.email}).
              Dopo l'approvazione, procedi con l'invito tramite la sezione "Client Users".
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span>{selectedRequest.first_name} {selectedRequest.last_name}</span></div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{selectedRequest.email}</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /><span>{selectedRequest.company}</span></div>
                {selectedRequest.job_title && <div className="flex items-center gap-2"><span className="text-muted-foreground">Ruolo:</span><span>{selectedRequest.job_title}</span></div>}
              </div>
              {selectedRequest.message && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><MessageSquare className="w-3 h-3" />Messaggio</div>
                  <p className="text-sm">{selectedRequest.message}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Note di revisione (opzionale)</Label>
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Aggiungi note..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>Annulla</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={isProcessing}
              onClick={() => selectedRequest && handleReview(selectedRequest.id, 'approved')}>
              {isProcessing ? 'Elaborazione...' : 'Approva e Procedi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
