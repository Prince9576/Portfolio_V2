// Tech skills shown as a holographic panel grid on the rooftop solar deck
export const GROUP_LEVEL = { Frontend: 'Expert' }
export const levelFor = (group) => GROUP_LEVEL[group] ?? 'Intermediate'

export const SKILLS = [
  // --- Frontend (Expert) — left column, top→bottom ---
  { id: 'html5', name: 'HTML5', group: 'Frontend', logo: '/textures/skills/html5-original.png', color: '#e34f26' },
  { id: 'css3', name: 'CSS3', group: 'Frontend', logo: '/textures/skills/css3-original.png', color: '#2392d6' },
  { id: 'javascript', name: 'JavaScript', group: 'Frontend', logo: '/textures/skills/javascript-original.png', color: '#f7df1e' },
  { id: 'typescript', name: 'TypeScript', group: 'Frontend', logo: '/textures/skills/typescript-original.png', color: '#3aa0ee' },
  { id: 'react', name: 'React', group: 'Frontend', logo: '/textures/skills/react-original.png', color: '#61dafb' },
  { id: 'angular', name: 'Angular', group: 'Frontend', logo: '/textures/skills/angular-original.png', color: '#dd0031' },
  { id: 'threejs', name: 'Three.js', group: 'Frontend', logo: '/textures/skills/threejs-original.png', color: '#cfcfcf' },

  // --- Backend (Intermediate) — right column ---
  { id: 'java', name: 'Java', group: 'Backend', logo: '/textures/skills/java-original.png', color: '#f89820' },
  { id: 'spring', name: 'Spring Boot', group: 'Backend', logo: '/textures/skills/spring-original.png', color: '#6db33f' },
  { id: 'nodejs', name: 'Node.js', group: 'Backend', logo: '/textures/skills/nodejs-original.png', color: '#7fc04a' },
  { id: 'mysql', name: 'MySQL', group: 'Backend', logo: '/textures/skills/mysql-original.png', color: '#2a9bc4' },

  // --- DevOps (Intermediate) ---
  { id: 'git', name: 'Git', group: 'DevOps', logo: '/textures/skills/git-original.png', color: '#f05032' },
  { id: 'cicd', name: 'CI/CD', group: 'DevOps', logo: '/textures/skills/githubactions-original.png', color: '#3a8eff' },

  // --- AI tooling (Intermediate) ---
  { id: 'claude', name: 'Claude / AI', group: 'AI', logo: '/textures/skills/claude.png', color: '#e0905c' },
]
