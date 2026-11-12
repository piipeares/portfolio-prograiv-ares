/**
 * Fuente única de contenido del portfolio.
 * Server (Astro) y cliente (islas React) leen el mismo archivo.
 */

export const SITE = {
  name: 'Felipe Ares',
  alias: 'Felipe Ares',
  role: 'Diseñador UX/UI · Desarrollador multimedial',
  location: 'Buenos Aires, Argentina',
  year: '2026',
  email: 'felipearespacheco@gmail.com',
  phone: '+54 911 3420-6387',
  whatsapp: 'https://wa.me/5491134206387',
  linkedin: 'https://www.linkedin.com/in/felipejarespacheco/',
  university: 'Universidad Maimónides',
  degree: 'Licenciatura en Tecnología Multimedial',
  status: 'Disponible para proyectos y colaboraciones',
} as const;

export type ChannelId = 0 | 1 | 2 | 3;
export type ProjectCategory = 'imagen' | 'interfaz' | 'sistema';

export interface Channel {
  id: ChannelId;
  code: string;
  label: string;
  short: string;
  frequency: string;
  description: string;
}

export const CHANNELS: Channel[] = [
  {
    id: 0,
    code: 'CH 00',
    label: 'Todo el espectro',
    short: 'Todo',
    frequency: '00.0',
    description: 'Todas las piezas, sin filtro. El archivo completo.',
  },
  {
    id: 1,
    code: 'CH 01',
    label: 'Imagen',
    short: 'Imagen',
    frequency: '01.4',
    description: '3D, materiales y movimiento. La parte visual del sistema.',
  },
  {
    id: 2,
    code: 'CH 02',
    label: 'Interfaz',
    short: 'Interfaz',
    frequency: '02.7',
    description: 'Producto, web y sistemas de diseño. Donde el usuario decide.',
  },
  {
    id: 3,
    code: 'CH 03',
    label: 'Sistema',
    short: 'Sistema',
    frequency: '03.9',
    description: 'Archivo, proceso y experimentación. Las reglas detrás de la imagen.',
  },
];

export interface Project {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  category: ProjectCategory;
  categoryLabel: string;
  year: string;
  tools: string[];
  description: string;
  challenge: string;
  learning: string;
  role: string;
  accent: string;
  cover: 'grid' | 'orbit' | 'type' | 'archive' | 'wave' | 'signal';
}

export const PROJECTS: Project[] = [
  {
    id: 'nintendo-switch',
    code: 'FA-01',
    title: 'Nintendo Switch',
    subtitle: 'Estudio de materiales PBR sobre hard-surface',
    category: 'imagen',
    categoryLabel: '3D / Render',
    year: '2023',
    tools: ['Autodesk Maya', 'Substance Painter', 'Arnold'],
    description:
      'Modelo 3D de la consola con foco en materiales PBR, imperfecciones reales y una iluminación de estudio que hace legible cada terminación.',
    challenge:
      'Lograr que plásticos, vidrio y metal convivieran en una sola pieza sin perder lectura a tamaño de detalle. El trabajo estuvo en el roughness, no en la geometría.',
    learning:
      'Un render no se vuelve creíble agregando textura: se vuelve creíble cuando la luz y la imperfección cuentan la misma historia.',
    role: 'Modelado, texturizado, look-dev y render',
    accent: '#d946ef',
    cover: 'orbit',
  },
  {
    id: 'vertex-identity',
    code: 'FA-02',
    title: 'Vertex Identity',
    subtitle: 'Sistema de identidad para una startup tech',
    category: 'interfaz',
    categoryLabel: 'Branding / UI',
    year: '2024',
    tools: ['Figma', 'Illustrator', 'Design tokens'],
    description:
      'Identidad visual y kit de interfaz para una startup: marca, tipografía, color, componentes y reglas de uso en producto digital.',
    challenge:
      'La marca tenía que funcionar en una landing, en un dashboard y en una presentación comercial sin convertirse en tres marcas distintas.',
    learning:
      'Un sistema de diseño no es una librería de componentes: es un contrato de decisiones que evita que el producto se degrade.',
    role: 'Dirección de arte, sistema de diseño y UI kit',
    accent: '#8b5cf6',
    cover: 'grid',
  },
  {
    id: 'kinetic-type',
    code: 'FA-03',
    title: 'Kinetic Type',
    subtitle: 'Tipografía cinética para un corto animado',
    category: 'imagen',
    categoryLabel: 'Motion / Tipografía',
    year: '2023',
    tools: ['After Effects', 'Cinema 4D', 'Illustrator'],
    description:
      'Secuencia de títulos donde la tipografía es acción: acelera, se corta, se reconstruye y marca el ritmo de la pieza.',
    challenge:
      'Sincronizar el movimiento con el audio sin que la tipografía se volviera un adorno ilegible. La dificultad fue el tempo, no el efecto.',
    learning:
      'En motion, el espacio entre dos keyframes comunica más que los keyframes. El silencio también es diseño.',
    role: 'Concepto, animación y composición',
    accent: '#22d3ee',
    cover: 'type',
  },
  {
    id: 'umaiverse',
    code: 'FA-04',
    title: 'Umaiverse',
    subtitle: 'Ecosistema digital interactivo',
    category: 'sistema',
    categoryLabel: 'Proyecto final / Web',
    year: '2021',
    tools: ['React', 'Three.js', 'Motion'],
    description:
      'Proyecto final de carrera: un ecosistema narrativo que conecta escenas 3D, contenido y navegación no lineal en una sola experiencia.',
    challenge:
      'Sostener una narrativa sin un recorrido único, sin que el usuario se pierda o abandone. La navegación tenía que ser parte del relato.',
    learning:
      'La libertad de recorrido necesita señales de orientación. Sin mapa, la exploración se vuelve abandono.',
    role: 'Concepto, dirección de experiencia y desarrollo frontend',
    accent: '#a78bfa',
    cover: 'wave',
  },
  {
    id: 'archivo-dtp',
    code: 'FA-05',
    title: 'Archivo DTP',
    subtitle: 'Control visual para proyectos multilingües',
    category: 'sistema',
    categoryLabel: 'Sistemas / Editorial',
    year: '2025',
    tools: ['InDesign', 'Photoshop', 'CAT tools', 'QA'],
    description:
      'Sistema de preparación, maquetación y control de calidad visual para entregables multilingües en un entorno de producción real.',
    challenge:
      'Detectar diferencias de criterio entre idiomas antes de que llegaran al cliente. El problema era el proceso, no el archivo.',
    learning:
      'La calidad visual también es logística: checklist, versionado y una persona responsable de decir “esto no sale así”.',
    role: 'DTP, control de calidad y documentación de proceso',
    accent: '#fbbf24',
    cover: 'archive',
  },
  {
    id: 'senal',
    code: 'FA-06',
    title: 'Portfolio 2026',
    subtitle: 'Este portfolio, como pieza de comunicación',
    category: 'interfaz',
    categoryLabel: 'Web / Interacción',
    year: '2026',
    tools: ['Astro', 'React islands', 'Three.js', 'Open-Meteo'],
    description:
      'Un portfolio entendido como un entorno que se sintoniza: la navegación recorre canales, y el clima real de Buenos Aires modifica la escena 3D en tiempo real.',
    challenge:
      'Migrar una escena 3D de Next.js a Astro sin perder impacto, manteniendo carga rápida, accesibilidad y estados reales de datos.',
    learning:
      'Astro no pelea con el 3D: lo aísla. La isla correcta hace que el resto del sitio siga siendo HTML liviano y defendible.',
    role: 'Concepto, diseño, desarrollo frontend y documentación',
    accent: '#f0abfc',
    cover: 'signal',
  },
];

export interface SkillGroup {
  title: string;
  items: string[];
}

export const SKILLS: SkillGroup[] = [
  {
    title: 'Diseño',
    items: ['UX / UI', 'Sistemas de diseño', 'Prototipado', 'Accesibilidad', 'Dirección de arte', 'Adobe Creative Suite', 'Figma', 'Autodesk Maya'],
  },
  {
    title: 'Código',
    items: ['HTML / CSS', 'JavaScript', 'TypeScript', 'React', 'Astro', 'Three.js', 'Tailwind CSS', 'Git'],
  },
  {
    title: 'Medios',
    items: ['Modelado 3D', 'Materiales PBR', 'Motion graphics', 'DTP editorial', 'Video', 'Producción de contenido'],
  },
];

export interface ExperienceItem {
  company: string;
  role: string;
  period: string;
  detail: string;
}

export const EXPERIENCE: ExperienceItem[] = [
  {
    company: 'Mercedes-Benz · Boutique House',
    role: 'Soporte técnico y mantenimiento web',
    period: '2023 — presente',
    detail:
      'Mantenimiento de sitios y sistemas, interacción con bases de datos y servidores, relevamiento y documentación de requerimientos funcionales.',
  },
  {
    company: 'Trusted Translations',
    role: 'Especialista DTP · Freelance',
    period: '2024 — 2025',
    detail:
      'Maquetación para herramientas CAT, control de calidad visual y respuesta a requerimientos de project managers en proyectos multilingües.',
  },
  {
    company: 'Translated',
    role: 'Asistente de gestión de proyectos',
    period: '2023',
    detail:
      'Seguimiento de proyectos de traducción y DTP con equipos internacionales, control de entregas y coordinación de prioridades.',
  },
];

export interface EducationItem {
  eyebrow: string;
  title?: string;
  items?: string[];
  detail?: string;
}

export const EDUCATION: EducationItem[] = [
  {
    eyebrow: 'Universidad Maimónides',
    title: 'Licenciatura en Tecnología Multimedial',
    detail: 'Cuarto año en curso · Buenos Aires',
  },
  {
    eyebrow: 'Formación complementaria',
    items: [
      'UX/UI Design con Figma',
      'Workshop Design',
      'Inglés — Cambridge First (B2)',
    ],
    detail: 'Certificaciones y workshops',
  },
];

export const QUESTIONS = [
  {
    n: '01',
    title: '¿Cómo se traduce una identidad a un sistema?',
    body: 'Me interesa el momento en que una intuición visual se convierte en reglas que otra persona puede usar sin preguntarme nada.',
  },
  {
    n: '02',
    title: '¿Qué pasa cuando la interfaz propone en vez de pedir?',
    body: 'Diseño para que el usuario pueda decidir, equivocarse y volver. La interacción tiene que dejar huella, no solo confirmar un clic.',
  },
  {
    n: '03',
    title: '¿Cómo se recuerda una experiencia sin texto?',
    body: 'Trabajo con ritmo, color y movimiento porque son capaces de comunicar antes de que el visitante lea la primera línea.',
  },
];

export const PROCESS = [
  {
    n: '01',
    title: 'Observar',
    body: 'Relevar el contexto, el público y las restricciones reales antes de abrir Figma o el editor.',
  },
  {
    n: '02',
    title: 'Traducir',
    body: 'Convertir una idea en un sistema: jerarquía, reglas, componentes, movimiento y estados.',
  },
  {
    n: '03',
    title: 'Probar',
    body: 'Poner la pieza en manos de alguien. Si necesita explicación para funcionar, todavía no está terminada.',
  },
];

export const getChannel = (id: number): Channel =>
  CHANNELS.find((channel) => channel.id === id) ?? CHANNELS[0];

export const projectsForChannel = (id: number): Project[] => {
  if (id === 0) return PROJECTS;
  const map: Record<number, ProjectCategory> = { 1: 'imagen', 2: 'interfaz', 3: 'sistema' };
  const category = map[id];
  return category ? PROJECTS.filter((project) => project.category === category) : PROJECTS;
};
