# Orbita — base del proyecto

Plataforma donde el estudiante describe su problema académico a un chat de IA y
Orbita lo conecta con el tutor adecuado.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- Clerk para autenticación y usuarios
- **Nada de IA ni base de datos todavía**: la demo usa datos locales

## Arranque

```bash
pnpm install
pnpm --filter web dev
```

Las claves de desarrollo de Clerk ya están en `apps/web/.env.local` (las generó
el CLI: `npx clerk@latest init`). Para otro entorno, copia
`apps/web/.env.example` a `.env.local` y rellénalo.

```bash
pnpm lint    # eslint
pnpm build   # next build
pnpm check   # lint + build
```

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | Portada pública. Si hay sesión, redirige al panel que corresponde. |
| `/sign-in`, `/sign-up` | Autenticación de Clerk, en español. |
| `/elegir-rol` | Primera vez: elige estudiante o tutor. |
| `/estudiante` | Chat con el asistente + tutores recomendados. |
| `/tutor` | Bandeja de solicitudes. |

## Cómo funciona la simulación

No hay modelo de IA. Todo está en dos archivos locales:

**`src/lib/datos-demo.ts`** — el "asistente" es un guion:

1. `analizarMensaje()` detecta la materia con expresiones regulares
   (derivadas/ecuaciones → Matemáticas, código → Programación, ensayo → Redacción,
   concentración → Métodos de estudio, física → Física).
2. Con tres mensajes entrega un `Diagnostico`: resumen del problema, temas
   detected, qué tipo de tutor sirve, y **dos tutores con su % de afinidad y el
   motivo concreto** de cada recomendación.
3. Hay una latencia simulada (850 ms / 1500 ms) y los puntos de espera, para que
   se vea el ritmo de una respuesta real.

**`src/lib/almacen.ts`** — el estado vive en `localStorage`, que hace de
"base de datos" para la demo:

- Lo que el estudiante envía desde el panel aparece en la bandeja del tutor
  (y al revés: si el tutor acepta, el estudiante ve el cambio).
- Se sincroniza entre pestañas con el evento `storage`.
- Se lee en `useEffect`, nunca durante el render, para no romper la hidratación.

Para limpiar la demo: borra las claves `orbita:demo:*` del localStorage.

### Cómo ensayar el flujo de los dos lados

En desarrollo, las cabeceras de los dos paneles tienen un botón **"⇄ Ver como
tutor/estudiante"** que cambia el rol de la cuenta y salta al panel contrario.
Existe para no depender de dos navegadores ni de tocar el panel de Clerk en
plena demo. Se anula por completo en producción: el botón no se renderiza y la
action se niega a hacer nada.

Si prefieres cambiarlo a mano: panel de Clerk → tu usuario → *Public metadata*.

Y si quieres ver el estado real del `localStorage`, abre la consola y ejecuta
`localStorage.clear()` para reiniciar la demo.

## Modo demostración (sin login)

Para ensayar sin depender de cuentas ni de contraseñas, pon en `.env.local`:

```
DEMO_SIN_AUTH=1
```

Con eso:

- `/estudiante` y `/tutor` se abren **sin sesión**, sin comprobar el rol.
- La portada sustituye el registro por dos enlaces: *Entrar como estudiante* y
  *Entrar como tutor*.
- El botón "⇄ Ver como…" pasa a ser un enlace al otro panel.
- Los paneles muestran los nombres de la demo (Ana y Carla) y sin el botón de
  cuenta de Clerk.

Y además, en el panel del tutor aparece un **selector de cuentas de tutor**:
Carla, Diego, Rosa, Tomás y Lucía. Al cambiar de tutor ves su perfil completo
(materias, calificación, tarifa, disponibilidad) y **solo las solicitudes de su
materia**, con sus propias decisiones de aceptar o descartar. Sirve para ensayar
varios perfiles sin abrir tres navegadores.

Clerk **no se desinstala ni se toca**: el bypass solo evita exigir sesión, y todo
el código de autenticación sigue ahí y funcionando. Sin el bypass, el panel del
tutor vuelve a mostrar el perfil de la cuenta real y todas las solicitudes.

Dos avisos importantes:

1. Solo funciona con `pnpm dev`. `pnpm start` sirve el build con
   `NODE_ENV=production`, y un bypass de autenticación en producción es un
   agujero. Si activas la variable ahí, la app la ignora, mantiene Clerk y
   avisa por consola.
2. Para volver a la normalidad: quita `DEMO_SIN_AUTH=1` de `.env.local` y
   reinicia. No hay que tocar código.

## Cuentas de demo ya creadas

| Correo | Contraseña | Rol |
|---|---|---|
| `ana@orbita-demo.com` | `Demo1234!Orbita26` | estudiante |
| `carla@orbita-demo.com` | `Demo1234!Orbita26` | tutor |

Ojo: esta instancia de Clerk exige contraseñas de **15 caracteres o más**, y
rechaza el dominio `.test` en los correos.

## Componentes

| Archivo | Qué es |
|---|---|
| `src/components/ui.tsx` | Primitivas: botón, tarjeta, etiqueta, avatar, logo, estrellas. |
| `src/components/chat-asistente.tsx` | Chat del estudiante + diagnóstico + recomendaciones. |
| `src/components/bandeja-tutor.tsx` | Bandeja de solicitudes del tutor. |
| `src/components/papel-tutor.tsx` | Selector de cuentas de tutor + su perfil (demo). |
| `src/components/cambiar-rol.tsx` | Botón de demo para alternar rol (solo desarrollo). |
| `src/lib/modo-demo.ts` | Interruptor `DEMO_SIN_AUTH` y nombres de la demo. |
| `src/lib/rol.ts` | Roles en `publicMetadata` de Clerk y `exigirRol()`. |
| `src/lib/cambio-rol.ts` | Server Action del botón anterior. |
| `src/app/elegir-rol/acciones.ts` | Server Action del alta con elección de rol. |
| `src/proxy.ts` | Middleware de Clerk: sesión + rol. |

## Roles

El rol vive en el **`publicMetadata` de Clerk** (`{ "rol": "estudiante" }`), que
es la única fuente de verdad. La protección va en dos capas:

1. **`src/proxy.ts` (middleware de Clerk).** Exige sesión con `auth.protect()`
   en `/estudiante`, `/tutor` y `/elegir-rol`, y expulsa al usuario si su rol no
   corresponde con el panel que pide.
2. **Cada página protegida.** `await exigirRol('tutor')` lee el
   `publicMetadata` fresco con `currentUser()` y corrige cualquier desvío.

Dos capas porque Clerk v7 ya **no** mete el `publicMetadata` en el session
token: el middleware solo puede leer el rol si añades el claim en el panel de
Clerk, y aun así el token puede ir atrasado unos segundos tras cambiar el rol.
La página siempre ve el dato fresco, así que funciona sin configurar nada.

### Claim opcional para el middleware

Para que el middleware pueda expulsar por rol antes de que la página corrija,
añade en **Clerk Dashboard → Sessions → Customize session token**:

```json
{ "rol": "{{user.public_metadata.rol}}" }
```

El tipo ya está declarado en `src/lib/rol.ts` (`CustomJwtSessionClaims`).

## Reglas de este proyecto

- Todo el texto de la interfaz en español (incluido Clerk, vía `esES`).
- Los secretos solo en `.env.local`. Nunca en el código.
- El id de usuario de Clerk es la llave de los usuarios en la base de datos.
