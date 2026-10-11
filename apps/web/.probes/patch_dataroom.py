import io
p = 'src/app/data-room/[id]/page.tsx'
s = io.open(p, encoding='utf-8').read()

old = """import { AppShell } from '@/components/layout/AppShell';"""
new = """import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';"""
assert s.count(old) == 1; s = s.replace(old, new)

# rail definition before return
old = """  const totalStorage = documents.reduce((sum, doc) => sum + doc.size, 0);
  const maxStorage = 1073741824; // 1GB
  const storageUsedPercent = (totalStorage / maxStorage) * 100;

  return (
    <AppShell
      showHelp"""
new = """  const totalStorage = documents.reduce((sum, doc) => sum + doc.size, 0);
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
      rail={rail}"""
assert s.count(old) == 1; s = s.replace(old, new)

# notice under the tabs
old = """        <TabsContent value="documents" className="space-y-6">
          {/* Storage Usage */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="icon-sm text-muted-foreground" />
                  <span className="text-sm font-medium">Storage Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatFileSize(totalStorage)} / {formatFileSize(maxStorage)}
                </span>
              </div>
              <Progress value={storageUsedPercent} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {documents.length} documents • {storageUsedPercent.toFixed(1)}% used
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Folders Sidebar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Folders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  onClick={() => setSelectedFolder(null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    selectedFolder === null
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <Folder className="icon-sm" />
                  All Documents
                  <Badge variant="secondary" className="ml-auto">
                    {documents.length}
                  </Badge>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                      selectedFolder === folder.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Folder className="icon-sm" />
                    {folder.name}
                    {!folder.isPublic && <Lock className="icon-sm ml-1" />}
                    <Badge variant="secondary" className="ml-auto">
                      {folder.documentCount}
                    </Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card className="lg:col-span-3">"""
new = """        <TabsContent value="documents" className="space-y-6">
          <SampleDataNotice
            surface="Data room"
            detail="Documents, investors and the access log are illustrative — the data room has no backend storage yet."
            askAiPrompt="Why does the data room show sample documents?"
          />

          {/* The storage meter and the folder tree live in the page rail; the
              column is the document list alone. */}
          <div>
            {/* Documents List */}
            <Card>"""
assert s.count(old) == 1; s = s.replace(old, new)

# fix search input width (was fixed 300px inside a now-full-width card)
old = """                      className="pl-9 w-[300px]"
                    />
                  </div>
                </div>"""
new = """                      className="pl-9 w-full sm:w-[300px]"
                    />
                  </div>
                </div>"""
assert s.count(old) == 1; s = s.replace(old, new)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('ok')
