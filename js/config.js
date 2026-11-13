/*
 * App settings. Change the names and file paths here.
 *
 * Where the data lives:
 *   - Supabase URL and key filled in below  -> families, members and users are stored in Supabase
 *     (shared by everyone, sign-in checked by the database). See README → "Store the data in Supabase".
 *   - Left empty                            -> demo mode: data comes from the CSV files in data/
 *     and changes are saved only in the browser.
 */
const CONFIG = {
  appName: 'Harihara Family Register',
  villageName: 'Harihara, Davangere',

  // Supabase → Project Settings → API. Use the "anon public" (or "publishable") key,
  // never the "service_role" / "secret" key.
  supabase: {
    url: 'https://xdlcxxynupmtterlrlmz.supabase.co',     
    anonKey: 'sb_publishable_PhYmbJgx2ECcU8iKRQuvFA_fl_gkuF7',  // e.g. 'eyJhbGciOi...' or 'sb_publishable_...'
  },

  // Demo mode only: CSV files, relative to the site root.
  files: {
    users: 'data/users.csv',
    families: 'data/families.csv',
    members: 'data/members.csv',
  },

  // New families get codes like FAM-001, FAM-002, ...
  familyCodePrefix: 'FAM-',

  // Shown after the English relation everywhere in the app ("Husband / Shohar").
  // Change a word here, or remove a line to show only the English.
  relationNames: {
    Self: 'Mukhiya', Wife: 'Biwi', Husband: 'Shohar', Son: 'Beta', Daughter: 'Beti',
    Father: 'Walid', Mother: 'Walida', Brother: 'Bhai', Sister: 'Behen',
    Grandson: 'Pota', Granddaughter: 'Poti', Grandfather: 'Dada', Grandmother: 'Dadi',
    'Daughter-in-law': 'Bahu', 'Son-in-law': 'Damad', 'Father-in-law': 'Sasur', 'Mother-in-law': 'Saas',
    'Brother-in-law': 'Saala', 'Sister-in-law': 'Bhabhi', Nephew: 'Bhatija', Niece: 'Bhatiji',
    Uncle: 'Chacha', Aunt: 'Chachi', Cousin: 'Chachazad', Other: 'Rishtedaar',
  },

  // Demo mode only: logins shown on the sign-in page. Set showDemoLogins to false before real use.
  showDemoLogins: true,
  demoLogins: [
    { username: 'admin', password: 'admin123', role: 'Admin' },
    { username: 'volunteer', password: 'volunteer123', role: 'Volunteer' },
    { username: 'viewer', password: 'viewer123', role: 'Viewer' },
  ],
};
