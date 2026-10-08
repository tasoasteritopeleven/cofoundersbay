'use client';

import { useState } from 'react';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { useParams } from 'next/navigation';
import {
  FileText,
  Folder,
  Upload,
  Download,
  Share2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  MoreVertical,
  Search,
  Filter,
  Grid,
  List,
  Clock,
  Users,
  Trash2,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  File,
  Image,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileJson,
  FileType2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn, initialsOf } from '@/lib/utils';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { bilingualInline } from '@/lib/i18n/format';
import { useDateFormat } from '@/lib/i18n/useDateFormat';

// Types
interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'xls' | 'ppt' | 'img' | 'other';
  size: number;
  uploadedAt: string;
  updatedAt: string;
  uploadedBy: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  folderId?: string;
  isPublic: boolean;
  downloadCount: number;
  viewCount: number;
  status: 'active' | 'archived' | 'pending';
  tags: string[];
  description?: string;
}

interface Folder {
  id: string;
  name: string;
  createdAt: string;
  documentCount: number;
  isPublic: boolean;
  parentId?: string;
}

interface Investor {
  id: string;
  name: string;
  email: string;
  firm?: string;
  avatarUrl?: string;
  accessLevel: 'view' | 'download' | 'admin';
  lastAccessed?: string;
  documentsViewed: number;
  documentsDownloaded: number;
}

interface AccessLog {
  id: string;
  investorId: string;
  investorName: string;
  action: 'view' | 'download' | 'upload' | 'share';
  documentName: string;
  timestamp: string;
  ipAddress?: string;
}

// Mock data
const DEMO_DOCUMENTS: Document[] = [
  {
    id: '1',
    name: 'Pitch Deck v2.pdf',
    type: 'pdf',
    size: 5242880,
    uploadedAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-20T14:30:00Z',
    uploadedBy: {
      id: '1',
      name: 'Elena Papadopoulos',
    },
    folderId: '1',
    isPublic: true,
    downloadCount: 12,
    viewCount: 45,
    status: 'active',
    tags: ['pitch', 'investors', '2026'],
    description: 'Updated pitch deck with Q1 2026 metrics',
  },
  {
    id: '2',
    name: 'Financial Projections.xlsx',
    type: 'xls',
    size: 1048576,
    uploadedAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-10T09:00:00Z',
    uploadedBy: {
      id: '1',
      name: 'Elena Papadopoulos',
    },
    folderId: '2',
    isPublic: false,
    downloadCount: 8,
    viewCount: 15,
    status: 'active',
    tags: ['financials', 'projections', 'confidential'],
  },
  {
    id: '3',
    name: 'Product Demo.mp4',
    type: 'other',
    size: 52428800,
    uploadedAt: '2026-03-12T11:00:00Z',
    updatedAt: '2026-03-12T11:00:00Z',
    uploadedBy: {
      id: '2',
      name: 'Marcus Chen',
    },
    folderId: '1',
    isPublic: true,
    downloadCount: 5,
    viewCount: 32,
    status: 'active',
    tags: ['demo', 'product', 'video'],
  },
  {
    id: '4',
    name: 'Cap Table.pdf',
    type: 'pdf',
    size: 2097152,
    uploadedAt: '2026-03-08T16:00:00Z',
    updatedAt: '2026-03-18T10:00:00Z',
    uploadedBy: {
      id: '1',
      name: 'Elena Papadopoulos',
    },
    folderId: '2',
    isPublic: false,
    downloadCount: 3,
    viewCount: 8,
    status: 'active',
    tags: ['legal', 'cap-table', 'confidential'],
    description: 'Updated with new investor allocations',
  },
];

const DEMO_FOLDERS: Folder[] = [
  {
    id: '1',
    name: 'Pitch Materials',
    createdAt: '2026-03-01T00:00:00Z',
    documentCount: 2,
    isPublic: true,
  },
  {
    id: '2',
    name: 'Financials',
    createdAt: '2026-03-01T00:00:00Z',
    documentCount: 2,
    isPublic: false,
  },
  {
    id: '3',
    name: 'Legal Documents',
    createdAt: '2026-03-01T00:00:00Z',
    documentCount: 0,
    isPublic: false,
  },
];

const DEMO_INVESTORS: Investor[] = [
  {
    id: '1',
    name: 'Alex Dimitriou',
    email: 'alex@investor.vc',
    firm: 'Dimitriou Ventures',
    accessLevel: 'download',
    lastAccessed: '2026-03-27T14:30:00Z',
    documentsViewed: 12,
    documentsDownloaded: 5,
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@techfund.com',
    firm: 'TechFund Capital',
    accessLevel: 'view',
    lastAccessed: '2026-03-26T10:00:00Z',
    documentsViewed: 8,
    documentsDownloaded: 0,
  },
  {
    id: '3',
    name: 'Michael Chen',
    email: 'michael@seedplus.io',
    firm: 'SeedPlus',
    accessLevel: 'admin',
    lastAccessed: '2026-03-27T16:00:00Z',
    documentsViewed: 15,
    documentsDownloaded: 8,
  },
];

const DEMO_ACCESS_LOGS: AccessLog[] = [
  {
    id: '1',
    investorId: '1',
    investorName: 'Alex Dimitriou',
    action: 'download',
    documentName: 'Pitch Deck v2.pdf',
    timestamp: '2026-03-27T14:30:00Z',
    ipAddress: '192.168.1.100',
  },
  {
    id: '2',
    investorId: '2',
    investorName: 'Sarah Johnson',
    action: 'view',
    documentName: 'Product Demo.mp4',
    timestamp: '2026-03-27T13:15:00Z',
    ipAddress: '192.168.1.101',
  },
  {
    id: '3',
    investorId: '1',
    investorName: 'Alex Dimitriou',
    action: 'view',
    documentName: 'Financial Projections.xlsx',
    timestamp: '2026-03-27T12:00:00Z',
    ipAddress: '192.168.1.100',
  },
];

export default function DataRoomPage() {
  const fmtDate = useDateFormat();
  const params = useParams();
  const roomId = params?.id as string;
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('documents');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const documents = DEMO_DOCUMENTS;
  const folders = DEMO_FOLDERS;
  const investors = DEMO_INVESTORS;
  const accessLogs = DEMO_ACCESS_LOGS;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return fmtDate(dateString, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFileIcon = (type: string) => {
    const icons: Record<string, any> = {
      pdf: FileText,
      doc: FileText,
      xls: FileSpreadsheet,
      ppt: Presentation,
      img: Image,
      other: File,
    };
    return icons[type] || File;
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = selectedFolder ? doc.folderId === selectedFolder : true;
    return matchesSearch && matchesFolder;
  });

  // Sample rows (no storage backend yet): the file commands say why they
  // cannot run, the same reason their menu items give.
  const SAMPLE_EN = 'Sample document - no file storage yet.';
  const SAMPLE_EL = 'Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων.';
  const docRows = documents.map((d) => ({ value: d.id, labelEn: d.name, labelEl: d.name }));
  usePageList([
    {
      id: 'documents',
      labelEn: 'Documents',
      labelEl: 'Έγγραφα',
      rows: filteredDocuments.map((d) => `${d.name} · ${formatFileSize(d.size)} · ${d.viewCount} views · ${d.status}`),
      total: documents.length,
      sample: true,
    },
    {
      id: 'investors',
      labelEn: 'Investors with access',
      labelEl: 'Επενδυτές με πρόσβαση',
      rows: investors.map((i) => `${i.name}${i.firm ? ` (${i.firm})` : ''} · ${i.accessLevel} · ${i.documentsViewed} viewed`),
      sample: true,
    },
  ]);
  usePageControls([
    choiceControl('data_room_tab', 'Data room section', 'Ενότητα data room', [
      { value: 'documents', en: 'Documents', el: 'Έγγραφα' },
      { value: 'investors', en: 'Investors', el: 'Επενδυτές' },
      { value: 'activity', en: 'Activity', el: 'Δραστηριότητα' },
      { value: 'settings', en: 'Settings', el: 'Ρυθμίσεις' },
    ], activeTab, setActiveTab),
    choiceControl('view_mode', 'Document view', 'Προβολή εγγράφων', [
      { value: 'list', en: 'List', el: 'Λίστα' },
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
    ], viewMode, (v) => setViewMode(v as 'grid' | 'list')),
    choiceControl('folder', 'Folder', 'Φάκελος', [
      { value: 'all', en: 'All documents', el: 'Όλα τα έγγραφα' },
      ...folders.map((f) => ({ value: f.id, en: f.name, el: f.name })),
    ], selectedFolder ?? 'all', (v) => setSelectedFolder(v === 'all' ? null : v)),
    { id: 'share_access', labelEn: 'Share access with an investor', labelEl: 'Κοινοποίηση πρόσβασης σε επενδυτή', writes: false, run: () => setIsShareDialogOpen(true) },
    { id: 'upload', labelEn: 'Upload documents', labelEl: 'Μεταφόρτωση εγγράφων', writes: false, run: () => setIsUploadDialogOpen(true) },
    { id: 'download_document', labelEn: 'Download document', labelEl: 'Λήψη εγγράφου', writes: false, options: docRows, unavailableEn: SAMPLE_EN, unavailableEl: SAMPLE_EL, run: () => undefined },
    { id: 'delete_document', labelEn: 'Delete document', labelEl: 'Διαγραφή εγγράφου', writes: true, options: docRows, unavailableEn: SAMPLE_EN, unavailableEl: SAMPLE_EL, run: () => undefined },
    {
      id: 'revoke_access',
      labelEn: 'Revoke investor access',
      labelEl: 'Ανάκληση πρόσβασης επενδυτή',
      writes: true,
      options: investors.map((i) => ({ value: i.id, labelEn: i.name, labelEl: i.name })),
      unavailableEn: 'Sample investor - no access records yet.',
      unavailableEl: 'Δείγμα - δεν υπάρχουν ακόμη εγγραφές πρόσβασης.',
      run: () => undefined,
    },
  ]);

  const totalStorage = documents.reduce((sum, doc) => sum + doc.size, 0);
  const maxStorage = 1073741824; // 1GB
  const storageUsedPercent = (totalStorage / maxStorage) * 100;

  /*
   * The page rail: the storage meter and the folder tree are about the room,
   * not the document list — moving them out lets the table use the full
   * column. Same state, same handlers; nothing renders twice.
   */
  const rail: PageRailSection[] = [
    {
      id: 'room',
      glyph: 'building',
      labelEn: 'Room storage',
      labelEl: 'Αποθήκευση',
      content: (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="icon-sm text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">
                <BilingualText en="Storage usage" el="Χρήση αποθήκευσης" compact wrap />
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatFileSize(totalStorage)} / {formatFileSize(maxStorage)}
            </span>
          </div>
          <Progress value={storageUsedPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {documents.length} documents • {storageUsedPercent.toFixed(1)}% used
          </p>
        </div>
      ),
    },
    {
      id: 'folders',
      glyph: 'book',
      labelEn: 'Folders',
      labelEl: 'Φάκελοι',
      badge: selectedFolder ? 1 : null,
      content: (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              selectedFolder === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            <Folder className="icon-sm" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-left">
              <BilingualText en="All documents" el="Όλα τα έγγραφα" compact wrap />
            </span>
            <Badge variant="secondary" className="ml-auto">{documents.length}</Badge>
          </button>
          {folders.map((folder) => (
            <button
              type="button"
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                selectedFolder === folder.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <Folder className="icon-sm" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
              {!folder.isPublic && <Lock className="icon-sm shrink-0" aria-hidden="true" />}
              <Badge variant="secondary" className="ml-auto">{folder.documentCount}</Badge>
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      rail={rail}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsShareDialogOpen(true)}
          >
            <Share2 className="icon-sm mr-2" />
            <BilingualText en="Share Access" el="Κοινοποίηση πρόσβασης" compact />
          </Button>
          <Button size="sm" onClick={() => setIsUploadDialogOpen(true)}>
            <Upload className="icon-sm mr-2" />
            <BilingualText en="Upload" el="Μεταφόρτωση" compact />
          </Button>
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="documents"><BilingualText en="Documents" el="Έγγραφα" compact /></TabsTrigger>
          <TabsTrigger value="investors">Investors ({investors.length})</TabsTrigger>
          <TabsTrigger value="activity"><BilingualText en="Activity" el="Δραστηριότητα" compact /></TabsTrigger>
          <TabsTrigger value="settings"><BilingualText en="Settings" el="Ρυθμίσεις" compact /></TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <SampleDataNotice
            surface="Data room"
            detail="Documents, investors and the access log are illustrative — the data room has no backend storage yet."
            askAiPrompt="Why does the data room show sample documents?"
          />

          {/* The storage meter and the folder tree live in the page rail; the
              column is the document list alone. */}
          <div>
            {/* Documents List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
                    <Input
                      placeholder={bilingualInline("Search documents…", "Αναζήτηση εγγράφων…")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-[300px]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button aria-label="List view" aria-pressed={viewMode === 'list'}
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="icon-sm" />
                  </Button>
                  <Button aria-label="Grid view" aria-pressed={viewMode === 'grid'}
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="icon-sm" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === 'list' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><BilingualText en="Name" el="Όνομα" compact /></TableHead>
                        <TableHead><BilingualText en="Type" el="Τύπος" compact /></TableHead>
                        <TableHead><BilingualText en="Size" el="Μέγεθος" compact /></TableHead>
                        {/* Secondary columns from md: on a phone the name,
                            type and size are what tell documents apart, and
                            seven columns wrapped every cell a word a line. */}
                        <TableHead className="hidden md:table-cell"><BilingualText en="Uploaded" el="Μεταφορτώθηκε" compact /></TableHead>
                        <TableHead className="hidden md:table-cell"><BilingualText en="Access" el="Πρόσβαση" compact /></TableHead>
                        <TableHead className="hidden md:table-cell"><BilingualText en="Views" el="Προβολές" compact /></TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((document) => {
                        const FileIcon = getFileIcon(document.type);
                        return (
                          <TableRow key={document.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <FileIcon className="icon-md shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 font-medium">
                                    <span className="break-words">{document.name}</span>
                                    {document.isPublic ? (
                                      <Unlock className="icon-sm shrink-0 text-status-success md:hidden" aria-label="Public" />
                                    ) : (
                                      <Lock className="icon-sm shrink-0 text-status-warning md:hidden" aria-label="Private" />
                                    )}
                                  </p>
                                  {document.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {document.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{document.type.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatFileSize(document.size)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {initialsOf(document.uploadedBy.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(document.uploadedAt)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {document.isPublic ? (
                                <Badge variant="outline" className="bg-status-success-bg text-status-success border-status-success-border">
                                  <Unlock className="icon-sm mr-1" />
                                  <BilingualText en="Public" el="Δημόσιο" compact />
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-status-warning-bg text-status-warning border-status-warning-border">
                                  <Lock className="icon-sm mr-1" />
                                  <BilingualText en="Private" el="Ιδιωτικό" compact />
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Eye className="icon-sm" />
                                  {document.viewCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Download className="icon-sm" />
                                  {document.downloadCount}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for ${document.name}`}>
                                    <MoreVertical className="icon-sm" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {/* The data room has no storage backend (see the
                                      notice above), so the file actions say so; Share
                                      opens the page's own share-access dialog. */}
                                  <UnavailableMenuItem icon={<Eye className="icon-sm mr-2 mt-0.5" aria-hidden="true" />} en="View" el="Προβολή" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                  <UnavailableMenuItem icon={<Download className="icon-sm mr-2 mt-0.5" aria-hidden="true" />} en="Download" el="Λήψη" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                  <DropdownMenuItem onSelect={() => setIsShareDialogOpen(true)}>
                                    <Share2 className="icon-sm mr-2" aria-hidden="true" />
                                    <BilingualText en="Share" el="Κοινοποίηση" compact />
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <UnavailableMenuItem icon={<Edit className="icon-sm mr-2 mt-0.5" aria-hidden="true" />} en="Edit" el="Επεξεργασία" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                  <UnavailableMenuItem className="text-destructive-accessible" icon={<Trash2 className="icon-sm mr-2 mt-0.5" aria-hidden="true" />} en="Delete" el="Διαγραφή" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocuments.map((document) => {
                      const FileIcon = getFileIcon(document.type);
                      return (
                        <Card key={document.id} className="group">
                          <CardContent>
                            <div className="flex items-start justify-between">
                              <FileIcon className="h-10 w-10 text-muted-foreground" />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button aria-label="More options"
                                    variant="ghost"
                                    size="icon"
                                    // focus-visible too: a keyboard user tabbing onto an
                                    // opacity-0 button saw nothing where focus was.
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="icon-sm" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <UnavailableMenuItem en="View" el="Προβολή" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                  <UnavailableMenuItem en="Download" el="Λήψη" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                  <DropdownMenuItem onSelect={() => setIsShareDialogOpen(true)}><BilingualText en="Share" el="Κοινοποίηση" compact /></DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <UnavailableMenuItem className="text-destructive-accessible" en="Delete" el="Διαγραφή" reasonEn="Sample document - no file storage yet." reasonEl="Δείγμα - δεν υπάρχει ακόμη αποθήκευση αρχείων." />
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-4">
                              <p className="font-medium truncate">{document.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatFileSize(document.size)} • {formatDate(document.uploadedAt)}
                              </p>
                              <div className="flex items-center gap-2 mt-3">
                                {document.isPublic ? (
                                  <Badge variant="outline" className="text-xs bg-status-success-bg text-status-success border-status-success-border">
                                    <BilingualText en="Public" el="Δημόσιο" compact />
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-status-warning-bg text-status-warning border-status-warning-border">
                                    <BilingualText en="Private" el="Ιδιωτικό" compact />
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Eye className="icon-sm" />
                                  {document.viewCount}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="investors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle><BilingualText en="Investor Access" el="Πρόσβαση επενδυτών" compact /></CardTitle>
              <Button size="sm" onClick={() => setIsShareDialogOpen(true)}>
                <Users className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Add Investor" el="Προσθήκη επενδυτή" compact />
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><BilingualText en="Investor" el="Επενδυτής" compact /></TableHead>
                    <TableHead><BilingualText en="Firm" el="Εταιρεία" compact /></TableHead>
                    <TableHead><BilingualText en="Access Level" el="Επίπεδο πρόσβασης" compact /></TableHead>
                    <TableHead><BilingualText en="Last Active" el="Τελευταία δραστηριότητα" compact /></TableHead>
                    <TableHead><BilingualText en="Activity" el="Δραστηριότητα" compact /></TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investors.map((investor) => (
                    <TableRow key={investor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {initialsOf(investor.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{investor.name}</p>
                            <p className="text-xs text-muted-foreground">{investor.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{investor.firm || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            investor.accessLevel === 'admin'
                              ? 'bg-status-accent-bg text-status-accent border-status-accent-border'
                              : investor.accessLevel === 'download'
                              ? 'bg-status-info-bg text-status-info border-status-info-border'
                              : 'bg-muted text-foreground border-border'
                          )}
                        >
                          {investor.accessLevel.charAt(0).toUpperCase() + investor.accessLevel.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {investor.lastAccessed ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDate(investor.lastAccessed)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground"><BilingualText en="Never" el="Ποτέ" compact /></span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="icon-sm" />
                            {investor.documentsViewed} viewed
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="icon-sm" />
                            {investor.documentsDownloaded} downloaded
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for ${investor.name}`}>
                              <MoreVertical className="icon-sm" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setActiveTab('activity')}><BilingualText en="View Activity" el="Προβολή δραστηριότητας" compact /></DropdownMenuItem>
                            <UnavailableMenuItem en="Edit Access" el="Επεξεργασία πρόσβασης" reasonEn="Sample investor - no access records yet." reasonEl="Δείγμα - δεν υπάρχουν ακόμη εγγραφές πρόσβασης." />
                            <UnavailableMenuItem en="Resend Invite" el="Επαναποστολή πρόσκλησης" reasonEn="Sample investor - no access records yet." reasonEl="Δείγμα - δεν υπάρχουν ακόμη εγγραφές πρόσβασης." />
                            <DropdownMenuSeparator />
                            <UnavailableMenuItem className="text-destructive-accessible" en="Revoke Access" el="Ανάκληση πρόσβασης" reasonEn="Sample investor - no access records yet." reasonEl="Δείγμα - δεν υπάρχουν ακόμη εγγραφές πρόσβασης." />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle><BilingualText en="Access Log" el="Αρχείο πρόσβασης" compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><BilingualText en="Investor" el="Επενδυτής" compact /></TableHead>
                    <TableHead><BilingualText en="Action" el="Ενέργεια" compact /></TableHead>
                    <TableHead><BilingualText en="Document" el="Έγγραφο" compact /></TableHead>
                    <TableHead><BilingualText en="Timestamp" el="Χρονοσφραγίδα" compact /></TableHead>
                    <TableHead><BilingualText en="IP Address" el="Διεύθυνση IP" compact /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.investorName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            log.action === 'download'
                              ? 'bg-status-info-bg text-status-info border-status-info-border'
                              : log.action === 'view'
                              ? 'bg-status-success-bg text-status-success border-status-success-border'
                              : 'bg-muted text-foreground border-border'
                          )}
                        >
                          {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.documentName}</TableCell>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Access Settings" el="Ρυθμίσεις πρόσβασης" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium"><BilingualText en="Require NDA" el="Απαίτηση NDA" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Require investors to sign NDA before accessing" el="Οι επενδυτές υπογράφουν NDA πριν την πρόσβαση" wrap />
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled title="The data room has no storage backend yet">
                    <BilingualText en="Configure" el="Ρύθμιση" compact />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium"><BilingualText en="Email Notifications" el="Ειδοποιήσεις email" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Notify when documents are accessed or downloaded" el="Ειδοποίηση όταν τα έγγραφα ανοίγονται ή κατεβαίνουν" wrap />
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled title="The data room has no storage backend yet">
                    <BilingualText en="Configure" el="Ρύθμιση" compact />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium"><BilingualText en="Download Watermarking" el="Υδατογράφημα λήψεων" compact /></p>
                    <p className="text-sm text-muted-foreground">
                      <BilingualText en="Add investor email watermark to downloaded PDFs" el="Υδατογράφημα με το email του επενδυτή στα PDF που κατεβαίνουν" wrap />
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled title="The data room has no storage backend yet">
                    <BilingualText en="Enable" el="Ενεργοποίηση" compact />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Room Information" el="Στοιχεία χώρου" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium"><BilingualText en="Room ID" el="Αναγνωριστικό χώρου" compact /></p>
                  <p className="text-sm text-muted-foreground">{roomId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium"><BilingualText en="Created" el="Δημιουργήθηκε" compact /></p>
                  <p className="text-sm text-muted-foreground">March 1, 2026</p>
                </div>
                <div>
                  <p className="text-sm font-medium"><BilingualText en="Owner" el="Κάτοχος" compact /></p>
                  <p className="text-sm text-muted-foreground">Elena Papadopoulos</p>
                </div>
                <div className="pt-4 border-t">
                  <Button variant="destructive" size="sm" disabled title="The data room has no storage backend yet">
                    <Trash2 className="icon-sm mr-2" aria-hidden="true" />
                    <BilingualText en="Delete Room" el="Διαγραφή χώρου" compact />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><BilingualText en="Upload Documents" el="Μεταφόρτωση εγγράφων" compact /></DialogTitle>
            <DialogDescription>
              <BilingualText en="Drag and drop files or click to browse" el="Σύρετε αρχεία ή πατήστε για αναζήτηση" wrap />
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="icon-xl mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <BilingualText en="Drop files here or click to browse" el="Αφήστε αρχεία εδώ ή πατήστε για αναζήτηση" wrap />
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <BilingualText en="PDF, DOC, XLS, PPT up to 100MB" el="PDF, DOC, XLS, PPT έως 100MB" compact wrap />
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2"><BilingualText en="Select Folder" el="Επιλογή φακέλου" compact /></p>
              <select className="w-full p-2 border rounded-xl">
                <option>{bilingualInline("Root", "Αρχικός φάκελος")}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="public" className="rounded" />
              <label htmlFor="public" className="text-sm">
                <BilingualText en="Make documents public to all investors" el="Δημόσια έγγραφα για όλους τους επενδυτές" wrap />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
            <Button disabled title="The data room has no storage backend yet"><BilingualText en="Upload" el="Μεταφόρτωση" compact /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><BilingualText en="Share Data Room" el="Κοινοποίηση data room" compact /></DialogTitle>
            <DialogDescription>
              <BilingualText en="Invite investors to access this data room" el="Προσκαλέστε επενδυτές σε αυτό το data room" wrap />
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div>
              <label htmlFor="dr-invite-email" className="text-sm font-medium mb-2 block"><BilingualText en="Email Address" el="Διεύθυνση email" compact /></label>
              <Input id="dr-invite-email" type="email" placeholder="investor@firm.com" />
            </div>
            <div>
              <label htmlFor="dr-invite-access" className="text-sm font-medium mb-2 block"><BilingualText en="Access Level" el="Επίπεδο πρόσβασης" compact /></label>
              <select id="dr-invite-access" className="w-full p-2 border rounded-xl">
                <option value="view">{bilingualInline("View Only", "Μόνο προβολή")}</option>
                <option value="download">{bilingualInline("View & Download", "Προβολή & λήψη")}</option>
                <option value="admin">{bilingualInline("Admin Access", "Πρόσβαση διαχειριστή")}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="notify" className="rounded" defaultChecked />
              <label htmlFor="notify" className="text-sm">
                <BilingualText en="Send email notification" el="Αποστολή ειδοποίησης email" compact />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
            {/* Every button that would write here had no handler; with no
                storage behind the room they say so rather than pretend. */}
            <Button disabled title="The data room has no storage backend yet"><BilingualText en="Send Invite" el="Αποστολή πρόσκλησης" compact /></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
