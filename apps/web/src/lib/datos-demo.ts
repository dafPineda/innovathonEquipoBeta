/**
 * Datos locales de demostración. Nada de esto sale de tu máquina.
 *
 * El "asistente" no es un modelo: es un guion. Detecta la materia del problema
 * con palabras clave y devuelve la respuesta preescrita de ese caso. Suficiente
 * para que la demo se vea creíble y el flujo se pueda probar sin Bedrock.
 */

export type Materia =
  | 'Matemáticas'
  | 'Programación'
  | 'Física'
  | 'Redacción'
  | 'Métodos de estudio';

export type Tutor = {
  id: string;
  nombre: string;
  iniciales: string;
  /** Clases de gradiente para el avatar. */
  color: string;
  titulo: string;
  materias: Materia[];
  calificacion: number;
  sesiones: number;
  creditosPorHora: number;
  /** Tiempo medio de respuesta en una sesión. */
  respuesta: string;
  disponibles: string[];
  enLinea: boolean;
};

export const TUTORES: Tutor[] = [
  {
    id: 'carla',
    nombre: 'Carla Ríos',
    iniciales: 'CR',
    color: 'from-marca-400 to-acento-500',
    titulo: '8 años enseñando cálculo y álgebra',
    materias: ['Matemáticas', 'Física'],
    calificacion: 4.9,
    sesiones: 128,
    creditosPorHora: 3,
    respuesta: '~35 min',
    disponibles: ['Hoy 18:00', 'Mañana 09:00', 'Miércoles 16:00'],
    enLinea: true,
  },
  {
    id: 'diego',
    nombre: 'Diego Mora',
    iniciales: 'DM',
    color: 'from-emerald-400 to-teal-500',
    titulo: 'Ingeniero de software · Python, SQL, algoritmos',
    materias: ['Programación'],
    calificacion: 4.8,
    sesiones: 96,
    creditosPorHora: 4,
    respuesta: '~20 min',
    disponibles: ['Ahora', 'Hoy 21:00', 'Sábado 10:00'],
    enLinea: true,
  },
  {
    id: 'rosa',
    nombre: 'Rosa Medina',
    iniciales: 'RM',
    color: 'from-rose-400 to-pink-500',
    titulo: 'Corrección de ensayos y presentaciones',
    materias: ['Redacción', 'Métodos de estudio'],
    calificacion: 4.7,
    sesiones: 74,
    creditosPorHora: 2,
    respuesta: '~1 h',
    disponibles: ['Mañana 11:00', 'Jueves 17:00'],
    enLinea: false,
  },
  {
    id: 'tomas',
    nombre: 'Tomás Aliaga',
    iniciales: 'TA',
    color: 'from-amber-400 to-orange-500',
    titulo: 'Métodos de estudio y ansiedad académica',
    materias: ['Métodos de estudio', 'Redacción'],
    calificacion: 4.6,
    sesiones: 51,
    creditosPorHora: 2,
    respuesta: '~2 h',
    disponibles: ['Hoy 19:30', 'Lunes 08:00'],
    enLinea: true,
  },
  {
    id: 'lucia',
    nombre: 'Lucía Feng',
    iniciales: 'LF',
    color: 'from-sky-400 to-cyan-500',
    titulo: 'Física: mecánica, eléctrica y óptica',
    materias: ['Física', 'Matemáticas'],
    calificacion: 4.9,
    sesiones: 63,
    creditosPorHora: 3,
    respuesta: '~40 min',
    disponibles: ['Ahora', 'Miércoles 19:00'],
    enLinea: true,
  },
];

export const TUTOR_POR_ID: Record<string, Tutor> = Object.fromEntries(
  TUTORES.map((t) => [t.id, t]),
);

export type Diagnostico = {
  materia: Materia;
  temas: string[];
  resumen: string;
  recomendacion: string;
  /** Por qué cada tutor encaja con este caso concreto. */
  tutores: { id: string; motivo: string; afinidad: number }[];
};

/** Un caso del guion, detectado por palabras clave. */
export type Perfil = {
  materia: Materia;
  temas: string[];
  resumen: string;
  recomendacion: string;
  tutores: { id: string; motivo: string; afinidad: number }[];
  primeraPregunta: string;
  segundaPregunta: string;
};

const PERFILES: { patron: RegExp; perfil: Perfil }[] = [
  {
    patron: /derivad|l[ií]mite|integral|ecuaci|calcul|matem|trigonom|funciones/,
    perfil: {
      materia: 'Matemáticas',
      temas: ['Cálculo diferencial', 'Límites', 'Regla de la cadena'],
      resumen:
        'El bloqueo no es la fórmula, es el procedimiento: hay un paso del razonamiento que no se ve.',
      recomendacion:
        'Un tutor de cálculo que haga el razonamiento paso a paso, no solo la fórmula final.',
      tutores: [
        {
          id: 'carla',
          motivo:
            'Su método es exactamente ése: primero el porqué, después la fórmula. Lleva 128 sesiones de cálculo.',
          afinidad: 94,
        },
        {
          id: 'lucia',
          motivo: 'Enseña la misma parte de tu curso con ejercicios parecidos a los tuyos.',
          afinidad: 81,
        },
      ],
      primeraPregunta:
        'Entiendo. Para afinar el diagnóstico: ¿de qué materia es exactamente y para cuándo lo necesitas?',
      segundaPregunta:
        'Perfecto. Una última cosa: ¿qué has intentado hasta ahora y en qué paso te pierdes?',
    },
  },
  {
    patron: /c[oó]digo|program|javascript|python|sql|base de datos|algorit|compila|html|css|java/,
    perfil: {
      materia: 'Programación',
      temas: ['Lógica de algoritmos', 'Depuración', 'Estructuras de datos'],
      resumen: 'El código compila pero no hace lo que esperas: es un error de lógica, no de sintaxis.',
      recomendacion: 'Alguien que depure contigo en vivo en lugar de mandarte el código corregido.',
      tutores: [
        {
          id: 'diego',
          motivo:
            'Trabaja con estos mismos casos a diario y enseña por diferencias: encuentra el error contigo en pantalla compartida.',
          afinidad: 96,
        },
        {
          id: 'carla',
          motivo: 'Buen método para ordenar ideas y detectar por dónde se rompe tu algoritmo.',
          afinidad: 68,
        },
      ],
      primeraPregunta:
        'Genial. Dime: ¿qué lenguaje estás usando y qué debería hacer el programa frente a lo que hace?',
      segundaPregunta:
        'Ya veo por dónde puede fallar. ¿Puedes pegar el fragmento o describir la parte que no entiendes?',
    },
  },
  {
    patron: /redacci|ensayo|tesis|exposici|resumen|tesis|cita|apa/,
    perfil: {
      materia: 'Redacción',
      temas: ['Estructura del ensayo', 'Argumentación', 'Citas'],
      resumen: 'Tienes el contenido pero no el orden ni el hilo: el texto comunica ideas sueltas.',
      recomendacion: 'Alguien que trabaje la estructura primero y el estilo después.',
      tutores: [
        {
          id: 'rosa',
          motivo: 'Corrige sobre todo estructura. Te devuelve un esquema del ensayo antes de tocar una palabra.',
          afinidad: 92,
        },
        {
          id: 'tomas',
          motivo: 'Te ayuda a ordenar el tiempo de escritura, que es donde suele atascarse la redacción.',
          afinidad: 74,
        },
      ],
      primeraPregunta:
        'Vamos allá. ¿De qué trata el texto y cuánta extensión tiene que tener?',
      segundaPregunta:
        'Perfecto. ¿Ya lo escribiste o estamos aún con el esquema?',
    },
  },
  {
    patron: /concentr|motivac|procrastin|ansiedad|tiempo de estudio|organiz|examene/,
    perfil: {
      materia: 'Métodos de estudio',
      temas: ['Plan de estudio', 'Técnicas de concentración', 'Gestión del tiempo'],
      resumen: 'El problema no es tu capacidad: es la distribución del tiempo y la técnica.',
      recomendacion: 'Alguien que te monte un plan concreto y te lo vaya ajustando.',
      tutores: [
        {
          id: 'tomas',
          motivo: 'Trabaja justo esto: planes por semanas, con revisión de lo que sí funcionó.',
          afinidad: 93,
        },
        {
          id: 'rosa',
          motivo: 'Te ordena entregas y te ayuda a no acumular trabajo hasta la noche anterior.',
          afinidad: 72,
        },
      ],
      primeraPregunta:
        'Te entiendo, y suele ser más común de lo que parece. ¿Cuántas horas al día puedes dedicar de verdad?',
      segundaPregunta:
        'Gracias. ¿Qué es lo que más te cuesta: empezar, mantener el ritmo o entender el contenido?',
    },
  },
  {
    patron: /f[ií]sic|mec[aá]nica|el[eé]ctric|termodin|cu[aá]ntic|newton|circuitos/,
    perfil: {
      materia: 'Física',
      temas: ['Mecánica newtoniana', 'Cálculo aplicado', 'Magnitudes'],
      resumen: 'Entras por la fórmula sin ver la situación física, y ahí es donde se pierde el hilo.',
      recomendacion: 'Un tutor que dibuje el sistema antes de escribir cualquier ecuación.',
      tutores: [
        {
          id: 'lucia',
          motivo: 'Empieza siempre por el dibujo del sistema y las magnitudes. Muy buen match para esto.',
          afinidad: 95,
        },
        {
          id: 'carla',
          motivo: 'Refuerza la parte matemática que suele ser el cuello de botella en física.',
          afinidad: 79,
        },
      ],
      primeraPregunta:
        'Claro. ¿De qué tema de física se trata y en qué punto del temario estás?',
      segundaPregunta:
        'Vale. ¿El enunciado lo entiendes y te cuesta pasarlo a fórmula, o ya tienes la fórmula?',
    },
  },
];

const PERFIL_GENERAL: Perfil = {
  materia: 'Métodos de estudio',
  temas: ['Diagnóstico inicial'],
  resumen: 'Todavía no hay suficiente información. Mejor un primer vistazo general que proponer un método.',
  recomendacion: 'Un tutor generalista para una sesión corta de encuadre.',
  tutores: [
    {
      id: 'tomas',
      motivo: 'Empieza siempre por entender el problema antes de proponer nada. Buen primer paso.',
      afinidad: 76,
    },
    {
      id: 'carla',
      motivo: 'Si al final el bloqueo es de números o de procedimiento, es la más versátil.',
      afinidad: 64,
    },
  ],
  primeraPregunta:
    'Cuéntame un poco más: ¿qué es lo que no puedes resolver y en qué materia exacta?',
  segundaPregunta: 'Gracias. ¿Y has pedido ayuda antes sobre esto o es la primera vez?',
};

/** Detecta de qué se trata con palabras clave. Sin IA: solo expresiones. */
export function analizarMensaje(texto: string): Perfil {
  const normal = texto.toLowerCase();
  for (const { patron, perfil } of PERFILES) {
    if (patron.test(normal)) return perfil;
  }
  return PERFIL_GENERAL;
}

export function construirDiagnostico(perfil: Perfil, textoUsuario: string): Diagnostico {
  const extracto = textoUsuario.trim().replace(/\s+/g, ' ');
  const resumen =
    extracto.length > 110 ? `${extracto.slice(0, 110)}…` : extracto;

  return {
    materia: perfil.materia,
    temas: perfil.temas,
    resumen: `«${resumen}» · ${perfil.resumen}`,
    recomendacion: perfil.recomendacion,
    tutores: perfil.tutores,
  };
}

export function respuestaDelAsistente(perfil: Perfil, turno: number): string {
  if (turno === 1) return perfil.primeraPregunta;
  if (turno === 2) return perfil.segundaPregunta;
  return 'Ya tengo lo que necesito. Este es el diagnóstico y a quién te recomiendo pedir ayuda:';
}

/** Chips de arranque, para que nadie se quede en blanco. */
export const SUGERENCIAS = [
  'No entiendo las derivadas de las funciones compuestas',
  'Mi código no compila y no sé por dónde empezar',
  'No logro concentrarme para estudiar antes de un examen',
  'Tengo que escribir un ensayo de 2000 palabras para la semana que viene',
];

/** Solicitudes que el tutor ve en su panel (datos de demostración). */
export type SolicitudDemo = {
  id: string;
  estudiante: string;
  iniciales: string;
  color: string;
  materia: Materia;
  titulo: string;
  descripcion: string;
  urgencia: 'alta' | 'media' | 'baja';
  creditos: number;
  hace: string;
};

export const SOLICITUDES_DEMO: SolicitudDemo[] = [
  {
    id: 's-1',
    estudiante: 'Ana Q.',
    iniciales: 'AQ',
    color: 'from-sky-400 to-blue-500',
    materia: 'Matemáticas',
    titulo: 'No entiendo la regla de la cadena',
    descripcion:
      'Aplico la fórmula y me da un resultado distinto al del libro. Ya lo intenté tres veces y siempre me pierdo en el paso intermedio.',
    urgencia: 'alta',
    creditos: 3,
    hace: 'hace 12 min',
  },
  {
    id: 's-2',
    estudiante: 'Bruno S.',
    iniciales: 'BS',
    color: 'from-acento-400 to-acento-500',
    materia: 'Programación',
    titulo: 'Una consulta de SQL que no termina',
    descripcion:
      'La consulta me devuelve duplicados y no entiendo por qué. Estoy usando JOIN con una tabla de relación.',
    urgencia: 'media',
    creditos: 4,
    hace: 'hace 40 min',
  },
  {
    id: 's-3',
    estudiante: 'Lucía P.',
    iniciales: 'LP',
    color: 'from-emerald-400 to-green-500',
    materia: 'Redacción',
    titulo: 'Revisión de estructura de ensayo',
    descripcion:
      'Tengo el contenido pero el párrafo final se me descuadra. Necesito que revisen si el orden es correcto.',
    urgencia: 'baja',
    creditos: 2,
    hace: 'hace 2 h',
  },
];

/**
 * Cursos o clases que publican los tutores en el muro. Viven en la base
 * (tabla cursos); los de ejemplo los carga supabase/esquema.sql.
 */
export type ComentarioCurso = {
  id: string;
  autor: string;
  iniciales: string;
  texto: string;
  /** Fecha ISO del comentario. */
  hora: string;
};

export type Curso = {
  id: string;
  tutorId: string;
  tutorNombre: string;
  tutorIniciales: string;
  tutorColor: string;
  titulo: string;
  descripcion: string;
  materia: Materia;
  modalidad: 'En línea' | 'Presencial';
  /** Texto libre: "Sábados 10:00", "Jueves 3 de octubre, 18:00"… */
  cuando: string;
  cupos: number;
  creditos: number;
  /** Fecha ISO de publicación. */
  publicado: string;
  /** Ids de quien le dio "me gusta". */
  meGusta: string[];
  inscritos: { id: string; nombre: string }[];
  comentarios: ComentarioCurso[];
};

export const MATERIAS: Materia[] = [
  'Matemáticas',
  'Programación',
  'Física',
  'Redacción',
  'Métodos de estudio',
];
