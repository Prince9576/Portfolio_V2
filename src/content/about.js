// Content for the hero "About" neon billboard at spawn. Swap the placeholders
// for the real portrait/resume/links and edit the copy — nothing else changes.
export const ABOUT = {
  name: 'Prince Kumar',
  portrait: '/textures/about/portrait.png', // drop your transparent headshot here
  title: 'Senior Full-Stack Developer',
  subtitle: 'Problem Solver',
  // ~100–140 chars reads best on the sign
  description:
    'I craft immersive, performant web experiences end-to-end — from real-time 3D worlds to rock-solid backends.',
  resume: '/resume.pdf', // place your PDF at public/resume.pdf
  links: {
    instagram: '#', // e.g. https://instagram.com/yourhandle
    github: '#', // e.g. https://github.com/yourhandle
    linkedin: '#', // e.g. https://linkedin.com/in/yourhandle
  },
  // Neon theme (matches the world's mystic violet + cyan)
  theme: { primary: '#8b5cff', accent: '#5ad1ff' },
}
