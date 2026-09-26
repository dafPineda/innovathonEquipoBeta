/**
 * Formas de los datos que viajan entre la API (/api/*) y los componentes.
 * Las fechas van como texto ISO y se formatean en el navegador (hora local).
 */

export type Lado = 'estudiante' | 'tutor';

export type EstadoSolicitud = 'enviada' | 'aceptada' | 'descartada';

export type SolicitudEnviada = {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteIniciales: string;
  estudianteColor: string;
  tutorId: string;
  tutorNombre: string;
  tutorIniciales: string;
  tutorColor: string;
  /** Mensaje del chat con el diagnóstico que originó la solicitud. */
  origen: string | null;
  materia: string;
  resumen: string;
  creditos: number;
  estado: EstadoSolicitud;
  creadaEn: string;
  /** Para la lista de conversaciones, sin pedir el chat entero. */
  ultimoMensaje: { autorId: string; texto: string; enviadoEn: string } | null;
};

export type MensajeSesion = {
  id: string;
  autorId: string;
  texto: string;
  enviadoEn: string;
};
