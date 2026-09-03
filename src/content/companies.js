// Work-experience shrines

const JOVEO = [
  'Architected and built a reusable data grid platform on AG Grid, shipped as a centralized React and TypeScript library now used across multiple products. Covered it with Jest unit tests, enforced ESLint and Prettier in CI, and reviewed contributions from teams adopting it. Along with development, worked directly with the AG Grid team to evaluate enterprise capabilities and negotiate licensing, helping balance technical requirements with cost considerations for the organization.',
  'Worked on internal Studio Platform ( Next.js ) for Trading team covering media planning, campaign audits and margin reporting. Used Server first RSC architecture with TanStack Query.',
  'Independently migrated large legacy modules to the new grid platform by creating AI-assisted workflows, custom plugins, and reusable migration patterns. Completed a migration of comparable scale in about one month versus six months previously, making future migrations substantially faster and easier for the engineering team.',
  'Led frontend development for a high-impact product under aggressive timelines, delivering a modular architecture that reduced feature delivery time from around 20 days to 5–6 days while maintaining high code quality and mentoring other developers.',
  'Optimized application performance through profiling and targeted improvements, reducing First Contentful Paint by 30–40%, eliminating UI lag, and bringing runtime warnings down from thousands to single digits.',
]

const PRATISHTHAN = [
  'Developed cross-platform applications (web/mobile) using React, Redux, Angular, and Ionic, building reusable, configuration-driven components.',
  'Led migration of a complex React application to Angular from scratch, driving planning, task allocation, and execution while mentoring junior developers.',
  'Improved performance, code quality, and maintainability through refactoring and adherence to best practices; collaborated in Agile environments and worked directly with clients on delivery.',
]

export const COMPANIES = [
  {
    id: 'joveo',
    name: 'Joveo',
    role: 'Senior Software Engineer · 2022 — Present',
    bullets: JOVEO,
    logo: { url: '/textures/joveo-logo.png', mode: 'alpha', shade: 0.5, sat: 1.35, gain: 1 },
  },
  {
    id: 'pratishthan',
    name: 'Pratishthan Software Ventures Pvt. Ltd',
    role: 'Software Engineer · 2019 — 2021',
    bullets: PRATISHTHAN,
    logo: { url: '/textures/pratishthan-logo.jpeg', mode: 'ink', lumaMax: 0.82, shade: 1, sat: 1.15, gain: 1.45 },
  },
]
