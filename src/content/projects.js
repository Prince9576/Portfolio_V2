// The frames in the Project Theatre. Each entry is one panel plus the popup it
// opens; `accent` drives the panel's neon halo, and the room fans however many
// are listed here.
//
// To fill an empty slot: drop a 320x200 (8:5) WebP into public/images and set
// `image` to its path, then replace the placeholder bullets. Leaving `image`
// null draws a neon "COMING SOON" plate instead.

const POSTINGS = [
  {
    label: 'Core delivery',
    text: 'Owned end-to-end frontend for a job-posting and campaign-management module in a large B2B React app — list views, multi-step creation flows, inline editing and audit trails.',
  },
  {
    label: 'Self-serve',
    text: 'Built a self-serve flow that let non-technical users create, schedule and edit campaigns on their own, removing manual ops involvement.',
  },
  {
    label: 'Reusability',
    text: 'Extracted posting/campaign tables into a shared, config-driven data-grid abstraction with persisted columns and server-side sort/filter, reused across 6+ surfaces.',
  },
  {
    label: 'Data viz',
    text: 'Built performance summary cards and trend charts over time-series spend metrics, with hover drilldowns, skeletons and retry on failure.',
  },
  {
    label: 'Performance',
    text: 'Cut list render cost via virtualisation, memoised cells and debounced cancellable server-side queries, replacing client-side scans of large datasets.',
  },
  {
    label: 'Micro-interactions',
    text: 'Added inline edit with optimistic updates and rollback, animated expand/collapse, hover reveals and undo toasts, built to Figma specs.',
  },
  {
    label: 'Correctness',
    text: 'Implemented currency-aware validation and threshold warnings on money inputs, plus a paginated audit log showing who changed what and when.',
  },
  {
    label: 'Team',
    text: 'Reviewed PRs, enforced TypeScript strictness and lint gates, and wrote migration guides other frontend engineers used to adopt the shared grid.',
  },
]

const GRID = [
  {
    label: 'Architecture',
    text: 'Built and shipped a versioned React + TypeScript data grid library (~14K LOC) on top of a virtualized table engine, published to a private npm registry. Split it into composable feature modules (sort, pagination, column manager, row expand, summary, editing) with peer deps and an escape hatch so teams never had to fork it.',
  },
  {
    label: 'Performance',
    text: 'Kept scrolling smooth on very large datasets by holding the grid mounted across refetches and routing consumer callbacks through refs, so inline props never remount headers or cells. Added adaptive column sizing on resize and a bundle audit that kept the library layer around 50 KB.',
  },
  {
    label: 'State and persistence',
    text: 'Built a drag and drop column manager with search, dirty tracking and reset, backed by layout persistence that debounces writes and reconciles saved state against changing columns. Fixed ordering bugs where pinning and remounts silently dropped user column moves.',
  },
  {
    label: 'Theming and i18n',
    text: 'Added a token driven theme layer (typography, palette, sizing, icons) bridging our design system with the grid engine, so teams got consistent UI with no per instance CSS. Shipped 3 locales with global or per grid switching and per key string overrides.',
  },
  {
    label: 'DX and tooling',
    text: 'Wrote the full docs set (API reference, integration checklist, performance guide, known limitations) plus Storybook stories and a playground app used as the adoption reference. Built an internal AI coding agent plugin with scaffold and migrate skills that generates grid setups from existing table code.',
  },
]

// Five labelled points per empty slot, so a new project keeps the popup's shape.
const PLACEHOLDER_BULLETS = [
  { label: 'Overview', text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit — sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' },
  { label: 'Approach', text: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.' },
  { label: 'Build', text: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.' },
  { label: 'Impact', text: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
  { label: 'Learnings', text: 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem.' },
]

export const PROJECTS = [
  {
    id: 'postings',
    title: 'Job Postings & Campaigns',
    role: 'End-to-end frontend · React · TypeScript',
    accent: '#ff4d0a',
    image: '/images/postings.webp',
    bullets: POSTINGS,
  },
  {
    id: 'grid',
    title: 'Data Grid Platform',
    role: 'Shared React + TypeScript library · ~14K LOC',
    accent: '#ff7a29',
    image: '/images/grid.webp',
    bullets: GRID,
  },
  {
    id: 'slot3',
    title: 'Coming Soon',
    role: 'Case study in progress',
    accent: '#ffa03d',
    image: null,
    bullets: PLACEHOLDER_BULLETS,
  },
  {
    id: 'slot4',
    title: 'Coming Soon',
    role: 'Case study in progress',
    accent: '#c9350d',
    image: null,
    bullets: PLACEHOLDER_BULLETS,
  },
  {
    id: 'slot5',
    title: 'Coming Soon',
    role: 'Case study in progress',
    accent: '#8f260b',
    image: null,
    bullets: PLACEHOLDER_BULLETS,
  },
]
