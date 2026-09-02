// The five frames in the Project Theatre. Images are placeholders for now
// (rendered procedurally — see Theatre/textures.js); the popup reuses the
// work-experience panel, so a project is just a title + role + bullets.
const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit — sed do eiusmod tempor incididunt ut labore et dolore.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est.',
]

// Accent colour per frame — drives the neon frame glow + placeholder gradient.
export const PROJECTS = [
  { id: 'p1', title: 'Project One', role: 'Case Study · Placeholder', accent: '#8b5cff', bullets: LOREM },
  { id: 'p2', title: 'Project Two', role: 'Case Study · Placeholder', accent: '#4f9cff', bullets: LOREM },
  { id: 'p3', title: 'Project Three', role: 'Case Study · Placeholder', accent: '#5ad1ff', bullets: LOREM },
  { id: 'p4', title: 'Project Four', role: 'Case Study · Placeholder', accent: '#c4a2ff', bullets: LOREM },
  { id: 'p5', title: 'Project Five', role: 'Case Study · Placeholder', accent: '#ff7ad9', bullets: LOREM },
]
