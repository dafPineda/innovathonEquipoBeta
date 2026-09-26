-- =============================================================================
-- Órbita · esquema para Supabase (versión demo, sin validaciones)
-- Pégalo completo en Supabase → SQL Editor → Run.
-- Los usuarios son de Clerk: su id (user_2abc…) es la llave, por eso es text.
-- =============================================================================

-- Usuarios (estudiantes y tutores)
create table if not exists usuarios (
  id         text primary key,            -- id de Clerk
  rol        text not null,               -- 'estudiante' | 'tutor'
  nombre     text not null,
  iniciales  text,
  color      text,                        -- clases del gradiente del avatar
  creado_en  timestamptz default now()
);

-- Perfil extra de los tutores
create table if not exists tutores (
  usuario_id        text primary key references usuarios(id) on delete cascade,
  titulo            text,
  materias          text[] default '{}',
  calificacion      numeric default 5,
  sesiones          integer default 0,
  creditos_por_hora integer default 2,
  respuesta         text,                 -- '~35 min'
  disponibles       text[] default '{}',  -- {'Hoy 18:00','Mañana 09:00'}
  en_linea          boolean default false
);

-- Solicitudes de ayuda del estudiante a un tutor
create table if not exists solicitudes (
  id            uuid primary key default gen_random_uuid(),
  estudiante_id text references usuarios(id) on delete cascade,
  tutor_id      text references usuarios(id) on delete cascade,
  materia       text,
  resumen       text,
  origen        text,                     -- id del diagnóstico del chat
  creditos      integer default 0,
  estado        text default 'enviada',   -- 'enviada' | 'aceptada' | 'descartada'
  creada_en     timestamptz default now()
);

-- Chat entre estudiante y tutor (se abre al aceptar una solicitud)
create table if not exists mensajes (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid references solicitudes(id) on delete cascade,
  autor_id     text references usuarios(id) on delete cascade,
  texto        text,
  enviado_en   timestamptz default now()
);

-- Cursos y clases que publican los tutores
create table if not exists cursos (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     text references usuarios(id) on delete cascade,
  titulo       text,
  descripcion  text,
  materia      text,
  modalidad    text,                      -- 'En línea' | 'Presencial'
  cuando       text,                      -- 'Sábado 10:00'
  cupos        integer,
  creditos     integer default 0,
  publicado_en timestamptz default now()
);

create table if not exists inscripciones (
  curso_id      uuid references cursos(id) on delete cascade,
  estudiante_id text references usuarios(id) on delete cascade,
  inscrito_en   timestamptz default now(),
  primary key (curso_id, estudiante_id)
);

create table if not exists me_gusta (
  curso_id   uuid references cursos(id) on delete cascade,
  usuario_id text references usuarios(id) on delete cascade,
  primary key (curso_id, usuario_id)
);

create table if not exists comentarios (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid references cursos(id) on delete cascade,
  autor_id  text references usuarios(id) on delete cascade,
  texto     text,
  creado_en timestamptz default now()
);

-- =============================================================================
-- Datos de la demo (los mismos que usa la app hoy)
-- =============================================================================

insert into usuarios (id, rol, nombre, iniciales, color) values
  ('demo-estudiante', 'estudiante', 'Ana',          'AN', 'from-sky-400 to-blue-500'),
  ('carla',           'tutor',      'Carla Ríos',   'CR', 'from-marca-400 to-acento-500'),
  ('diego',           'tutor',      'Diego Mora',   'DM', 'from-emerald-400 to-teal-500'),
  ('rosa',            'tutor',      'Rosa Medina',  'RM', 'from-rose-400 to-pink-500'),
  ('tomas',           'tutor',      'Tomás Aliaga', 'TA', 'from-amber-400 to-orange-500'),
  ('lucia',           'tutor',      'Lucía Feng',   'LF', 'from-sky-400 to-cyan-500')
on conflict (id) do nothing;

insert into tutores (usuario_id, titulo, materias, calificacion, sesiones, creditos_por_hora, respuesta, disponibles, en_linea) values
  ('carla', '8 años enseñando cálculo y álgebra',             '{Matemáticas,Física}',                     4.9, 128, 3, '~35 min', '{"Hoy 18:00","Mañana 09:00","Miércoles 16:00"}', true),
  ('diego', 'Ingeniero de software · Python, SQL, algoritmos', '{Programación}',                           4.8,  96, 4, '~20 min', '{"Ahora","Hoy 21:00","Sábado 10:00"}',           true),
  ('rosa',  'Corrección de ensayos y presentaciones',          '{Redacción,"Métodos de estudio"}',         4.7,  74, 2, '~1 h',    '{"Mañana 11:00","Jueves 17:00"}',                false),
  ('tomas', 'Métodos de estudio y ansiedad académica',         '{"Métodos de estudio",Redacción}',         4.6,  51, 2, '~2 h',    '{"Hoy 19:30","Lunes 08:00"}',                    true),
  ('lucia', 'Física: mecánica, eléctrica y óptica',            '{Física,Matemáticas}',                     4.9,  63, 3, '~40 min', '{"Ahora","Miércoles 19:00"}',                    true)
on conflict (usuario_id) do nothing;

-- Solo si todavía no hay cursos, para poder ejecutar el script más de una vez
insert into cursos (tutor_id, titulo, descripcion, materia, modalidad, cuando, cupos, creditos)
select * from (values
  ('carla', 'Derivadas sin miedo: regla de la cadena paso a paso',
   'Clase de repaso para el primer parcial. Hacemos 6 ejercicios tipo examen explicando el porqué de cada paso, no solo la fórmula. Trae tus dudas.',
   'Matemáticas', 'En línea', 'Sábado 10:00', 12, 2),
  ('diego', 'Taller de SQL: JOINs que no duplican filas',
   'Taller práctico con una base de datos de ejemplo. Veremos INNER, LEFT y por qué aparecen duplicados con tablas de relación.',
   'Programación', 'En línea', 'Martes 19:00', 20, 3),
  ('tomas', 'Plan de estudio para la semana de exámenes',
   'Una sesión de grupo para armar tu calendario de estudio: bloques, descansos y qué repasar primero. Sales con tu plan hecho.',
   'Métodos de estudio', 'Presencial', 'Jueves 17:00 · Biblioteca central', 8, 1)
) as v
where not exists (select 1 from cursos);
