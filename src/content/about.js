// Content for the hero "About" neon billboard at spawn
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
  // Neon theme — drives the billboard's frame glow and CRT scanline.
  theme: { primary: '#ff4d0a', accent: '#8f260b' },
}
