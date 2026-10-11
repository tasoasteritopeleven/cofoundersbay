# One Greek word per concept for mentoring, on Greek-side UI strings only:
#   mentor(s) -> μέντορας / μέντορες, mentoring/mentorship -> καθοδήγηση,
#   mentee(s) -> καθοδηγούμενος / καθοδηγούμενοι.
# English strings and the assistant planner's input synonyms are untouched.
import os

EDITS = {
    'src/lib/i18n/strings-pages.ts': [
        ("title: 'Πίνακας ελέγχου mentor',", "title: 'Πίνακας ελέγχου μέντορα',"),
        ("'Συνεδρίες, αιτήματα, αποδοχές και επισκόπηση mentees.'", "'Συνεδρίες, αιτήματα, αποδοχές και επισκόπηση καθοδηγούμενων.'"),
        ("'Προγραμματισμένες και προηγούμενες συνεδρίες mentoring.'", "'Προγραμματισμένες και προηγούμενες συνεδρίες καθοδήγησης.'"),
        ("title: 'Αιτήματα mentees',", "title: 'Αιτήματα καθοδηγούμενων',"),
        ("'Αποδοχή ή απόρριψη νέων αιτημάτων mentoring.'", "'Αποδοχή ή απόρριψη νέων αιτημάτων καθοδήγησης.'"),
        ("title: 'Εύρεση mentors',", "title: 'Εύρεση μεντόρων',"),
        ("'Κατάλογος mentors — φιλτράρισμα κατά εξειδίκευση και διαθεσιμότητα.'", "'Κατάλογος μεντόρων — φιλτράρισμα κατά εξειδίκευση και διαθεσιμότητα.'"),
        ("title: 'Διαχείριση mentoring',", "title: 'Διαχείριση καθοδήγησης',"),
        ("'Έγκριση mentors, αξιολόγηση", "'Έγκριση μεντόρων, αξιολόγηση"),
        ("title: 'Ρύθμιση mentor',", "title: 'Ρύθμιση προφίλ μέντορα',"),
    ],
    'src/lib/page-registry.ts': [
        ("helpTitleEl: 'Πώς δουλεύουν τα αιτήματα mentee'", "helpTitleEl: 'Πώς λειτουργούν τα αιτήματα καθοδήγησης'"),
        ("helpTitleEl: 'Διαχείριση mentorship'", "helpTitleEl: 'Διαχείριση καθοδήγησης'"),
        ("helpTitleEl: 'Πώς δουλεύει η λίστα mentees'", "helpTitleEl: 'Πώς λειτουργεί η λίστα καθοδηγούμενων'"),
    ],
    'src/app/admin/mentorship-management/page.tsx': [
        ('titleEl="Διαχείριση mentoring"', 'titleEl="Διαχείριση καθοδήγησης"'),
        ('titleEl="Εποπτεία mentoring"', 'titleEl="Εποπτεία καθοδήγησης"'),
    ],
    'src/app/calendar/page.tsx': [("'Συνεδρία mentoring'", "'Συνεδρία καθοδήγησης'")],
    'src/app/dashboard/incubator/page.tsx': [
        ('`${menteesTaken} από ${menteeSlots} θέσεις mentees`', '`${menteesTaken} από ${menteeSlots} θέσεις καθοδηγούμενων`'),
    ],
    'src/app/dashboard/mentor/page.tsx': [
        ('"Ενεργοί mentees"', '"Ενεργοί καθοδηγούμενοι"'),
        ('`Αιτήματα mentoring (${pendingRequests.length})`', '`Αιτήματα καθοδήγησης (${pendingRequests.length})`'),
        ('"Οι mentees σας"', '"Οι καθοδηγούμενοί σας"'),
    ],
    'src/app/mentor/requests/page.tsx': [
        ("'Αιτήματα mentoring'", "'Αιτήματα καθοδήγησης'"),
        ('"Τα νέα αιτήματα mentoring θα εμφανίζονται εδώ."', '"Τα νέα αιτήματα καθοδήγησης θα εμφανίζονται εδώ."'),
    ],
    'src/app/org/mentors/page.tsx': [
        ('aria-label="Search mentors. Αναζήτηση μεντόρων"', "aria-label={bilingualAria('Search mentors', 'Αναζήτηση μεντόρων')}"),
    ],
}

n = 0
for path, reps in EDITS.items():
    s = open(path, encoding='utf8').read()
    for a, b in reps:
        if a not in s:
            print('MISSING', path, a[:60])
            continue
        s = s.replace(a, b)
        n += 1
    open(path, 'w', encoding='utf8').write(s)
print('replaced', n)
