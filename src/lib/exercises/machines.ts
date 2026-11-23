import type { ExerciseEquipment, MovementPattern, View2DMode } from '@/types/training';

export interface MachineSpec {
  /** Nombre real comercial y de referencia de la máquina, estación o implemento. */
  machineName: string;
  /** Instrucciones de ajuste de la máquina/estación antes de empezar. */
  machineSetup: string;
  /** Descripción completa de en qué máquina se realiza y cómo se ejecuta el movimiento. */
  description: string;
  /** Vista 2D principal recomendada al abrir el ejercicio. */
  defaultView: View2DMode;
}

/**
 * Base de datos técnica con las referencias reales de máquinas comerciales de gimnasio,
 * ajustes ergonómicos y descripción biomecánica para cada uno de los 103 ejercicios del catálogo.
 */
export const EXERCISE_MACHINE_SPECS: Record<string, MachineSpec> = {
  // ───────────── CUÁDRICEPS ─────────────
  'sentadilla-barra': {
    machineName: 'Jaula de potencia (Power Rack / Squat Rack) con barra olímpica de 20 kg',
    machineSetup:
      'Coloca los soportes (J-cups) a la altura del esternón medio y ajusta las barras laterales de seguridad unos 5 cm por debajo de tu profundidad máxima de sentadilla.',
    description:
      'Se realiza dentro de una jaula de potencia (Power Rack) con barra olímpica apoyada sobre el trapecio superior. Es el ejercicio base de fuerza e hipertrofia del tren inferior: consiste en sacar la barra de los soportes, dar dos pasos cortos atrás y descender flexionando cadera y rodillas de forma simultánea con la columna neutra antes de empujar el suelo para volver a la vertical.',
    defaultView: 'lateral',
  },
  'sentadilla-goblet': {
    machineName: 'Mancuerna hexagonal o pesa rusa (Goblet Free-Weight Station)',
    machineSetup:
      'Elige una mancuerna hexagonal y sujétala en vertical por debajo de uno de sus cabezales con ambas palmas pegadas al esternón.',
    description:
      'Se ejecuta en zona de peso libre sujetando una mancuerna en copa ("goblet") pegada al pecho. El contrapeso frontal facilita mantener el tronco erguido y alcanzar una flexión profunda de rodilla y cadera sin sobrecargar la zona lumbar.',
    defaultView: 'lateral',
  },
  'sentadilla-frontal': {
    machineName: 'Jaula de potencia (Power Rack) con barra olímpica en rack frontal',
    machineSetup:
      'Ajusta los soportes del rack a la altura de las clavículas y coloca las barras de seguridad a la altura de la ingle en posición de sentadilla profunda.',
    description:
      'Se realiza en jaula de potencia apoyando la barra olímpica sobre los deltoides anteriores y clavículas con los codos elevados al frente. Al situar la carga delante del eje corporal, exige un torso muy vertical y maximiza el reclutamiento de los cuádriceps y erectores torácicos.',
    defaultView: 'lateral',
  },
  'sentadilla-hack': {
    machineName: 'Máquina Hack Squat lineal a 45° con carro sobre rieles (Linear Hack Squat Machine)',
    machineSetup:
      'Apoya toda la espalda y el sacro contra el respaldo deslizante, mete los hombros bajo las hombreras acolchadas, coloca los pies a media altura de la plataforma inclinada y libera las palancas laterales de seguridad.',
    description:
      'Se ejecuta en la máquina Hack Squat a 45°, cuyo carro corre sobre rieles lineales de acero. Al estabilizar por completo el tronco contra el respaldo, elimina el factor de equilibrio y permite llevar los cuádriceps a máxima flexión de rodilla con total seguridad lumbar.',
    defaultView: 'lateral',
  },
  'sentadilla-pendulo': {
    machineName: 'Máquina de Sentadilla Péndulo (Pendulum Squat Machine)',
    machineSetup:
      'Coloca los hombros bajo las almohadillas del brazo basculante, apoya la espalda en el respaldo curvo, sitúa los pies en la mitad inferior de la plataforma angulada y retira el brazo de bloqueo.',
    description:
      'Se realiza en la máquina de sentadilla péndulo, que describe un arco circular alrededor de un pivote trasero en lugar de una línea recta. Esta curva de resistencia adapta la carga al perfil de fuerza de la pierna, logrando una flexión profunda de rodilla con máxima demanda en cuádriceps y glúteos.',
    defaultView: 'lateral',
  },
  'sentadilla-smith': {
    machineName: 'Máquina Multipower / Smith Machine con barra guiada sobre rieles verticales',
    machineSetup:
      'Ajusta los topes inferiores de seguridad en las columnas guía y adelanta los pies entre 15 y 25 cm respecto a la línea vertical de la barra.',
    description:
      'Se realiza en la máquina Multipower (Smith Machine), donde la barra olímpica se desliza fija sobre dos rieles verticales con ganchos giratorios de bloqueo. Permite concentrarse en el empuje de cuádriceps y glúteos con una trayectoria guiada y estable.',
    defaultView: 'lateral',
  },
  'prensa-piernas': {
    machineName: 'Prensa de piernas inclinada a 45° (45° Leg Press Sled Machine)',
    machineSetup:
      'Regula la inclinación del respaldo para que el sacro quede firme en el asiento, carga los discos olímpicos en las mangas laterales del trineo, apoya los pies al ancho de cadera en el centro de la plataforma y gira las palancas de bloqueo.',
    description:
      'Se ejecuta sentado y reclinado en la prensa de piernas a 45°, empujando una plataforma metálica que se desliza sobre rieles inclinados. Permite mover cargas altas para cuádriceps y glúteo mayor sin compresión axial sobre la columna vertebral.',
    defaultView: 'lateral',
  },
  'sentadilla-cinturon': {
    machineName: 'Máquina Belt Squat (Sentadilla con cinturón pélvico por palanca o cable)',
    machineSetup:
      'Colócate el cinturón acolchado alrededor de la pelvis, engancha el mosquetón al cable o brazo de carga inferior, sube a las plataformas laterales y libera el soporte central.',
    description:
      'Se realiza en la estación Belt Squat, donde la carga cuelga directamente de la cintura mediante un cinturón conectado a una palanca o polea baja entre los pies. Reproduce la biomecánica de la sentadilla libre con cero carga sobre los hombros y la columna lumbar.',
    defaultView: 'lateral',
  },
  'sentadilla-peso-corporal': {
    machineName: 'Zona de suelo firme / Tatami de calistenia (Peso corporal)',
    machineSetup:
      'Ubícate sobre una superficie plana y antideslizante con los pies al ancho de los hombros y las puntas abiertas unos 15–20°.',
    description:
      'Se realiza sin máquinas utilizando únicamente el peso corporal. Al descender, los brazos se proyectan hacia delante como contrapeso natural mientras la cadera baja entre las rodillas manteniendo toda la planta del pie en contacto con el suelo.',
    defaultView: 'lateral',
  },
  'sentadilla-banda': {
    machineName: 'Banda elástica cerrada de resistencia progresiva (Power Loop Band)',
    machineSetup:
      'Pisa el tramo inferior de la banda cerrada con ambos pies al ancho de hombros y pasa el lazo superior por encima de los trapecios o sujétalo frente a las clavículas.',
    description:
      'Se ejecuta con una banda elástica cerrada que genera tensión ascendente: mínima en el fondo de la sentadilla y máxima al extender las rodillas y la cadera arriba.',
    defaultView: 'frontal',
  },
  'zancada-mancuernas': {
    machineName: 'Par de mancuernas hexagonales en pasillo de peso libre',
    machineSetup:
      'Toma dos mancuernas del mismo peso con agarre neutro a los costados y asegúrate de contar con un pasillo despejado de al menos 4–6 metros.',
    description:
      'Se realiza caminando con una mancuerna en cada mano: das una zancada amplia al frente, flexionas ambas rodillas hasta que la trasera roce el suelo y empujas con el talón delantero para avanzar al siguiente paso.',
    defaultView: 'lateral',
  },
  'zancada-inversa': {
    machineName: 'Superficie plana antideslizante (Peso corporal)',
    machineSetup:
      'Colócate erguido con espacio libre detrás de ti y las manos en la cintura o frente al pecho para estabilizar.',
    description:
      'Se ejecuta sin máquina dando un paso largo hacia atrás y descendiendo en vertical hasta que el muslo delantero queda paralelo al suelo. Al iniciar hacia atrás, la tibia delantera se mantiene más vertical y reduce el estrés rotuliano.',
    defaultView: 'lateral',
  },
  'sentadilla-bulgara': {
    machineName: 'Soporte de rodillo para sentadilla búlgara o banco plano + par de mancuernas',
    machineSetup:
      'Coloca un banco plano o rodillo de sentadilla búlgara detrás de ti a la altura de la tibia, apoya el empeine trasero y adelanta el pie de trabajo un paso largo.',
    description:
      'Se realiza de forma unilateral con el empeine trasero elevado sobre un banco plano o soporte acolchado y mancuernas en las manos. Todo el peso recae en la pierna delantera, que baja en vertical flexionando cadera y rodilla para estimular intensamente cuádriceps y glúteo.',
    defaultView: 'lateral',
  },
  'sentadilla-bulgara-pc': {
    machineName: 'Banco plano de musculación o soporte acolchado de empeine (Peso corporal)',
    machineSetup:
      'Sitúa un banco plano estable a unos 60–75 cm detrás de tu talón delantero y apoya el empeine del pie trasero en el borde acolchado.',
    description:
      'Se ejecuta en un banco plano con el pie trasero elevado y sin carga externa. Permite dominar el equilibrio unilateral y la alineación de rodilla antes de añadir mancuernas.',
    defaultView: 'lateral',
  },
  'step-up': {
    machineName: 'Cajón pliométrico estable o banco plano + par de mancuernas (Plyo Box / Bench)',
    machineSetup:
      'Utiliza un cajón o banco estable cuya altura deje tu muslo paralelo al suelo al apoyar el pie encima (35–45 cm) y sujeta dos mancuernas a los costados.',
    description:
      'Se realiza frente a un cajón pliométrico o banco plano: apoyas toda la planta del pie de trabajo arriba, inclinas ligeramente el torso hacia delante y extiendes rodilla y cadera sin impulsarte con el pie del suelo.',
    defaultView: 'lateral',
  },
  'extension-cuadriceps': {
    machineName: 'Máquina de extensión de cuádriceps sentado con torre de placas (Seated Leg Extension Machine)',
    machineSetup:
      'Ajusta la profundidad del respaldo para que la articulación de tu rodilla coincida exactamente con el punto rojo de giro de la leva, y sitúa el rodillo acolchado sobre la parte baja de la tibia (justo encima del empeine).',
    description:
      'Se realiza sentado en la máquina de extensión de cuádriceps con columna de placas selectorizadas. Sujetando las asas laterales para fijar la cadera al asiento, extiendes las rodillas en arco hasta la contracción máxima del recto femoral y vastos, bajando de forma controlada.',
    defaultView: 'lateral',
  },

  // ───────────── ISQUIOS Y GLÚTEO ─────────────
  'peso-muerto-rumano': {
    machineName: 'Jaula de potencia (Power Rack) o plataforma con barra olímpica de 20 kg',
    machineSetup:
      'Coloca la barra en los soportes del rack a la altura de medio muslo para sacarla ya erguido, con agarre prono al ancho de hombros (o straps si la carga es alta).',
    description:
      'Se ejecuta con barra olímpica partiendo desde la posición erguida. Con las rodillas desbloqueadas en ligera flexión fija (15–20°), desplazas la cadera hacia atrás en bisagra deslizando la barra pegada a los muslos y espinillas hasta notar el máximo estiramiento isquiotibial.',
    defaultView: 'lateral',
  },
  'peso-muerto-rumano-mancuernas': {
    machineName: 'Par de mancuernas hexagonales en zona de peso libre',
    machineSetup:
      'Sujeta una mancuerna en cada mano en posición neutra/prona rozando la cara frontal-lateral de los muslos.',
    description:
      'Se realiza de pie con dos mancuernas: llevas la cadera hacia atrás manteniendo la columna neutra y las escápulas retraídas mientras las mancuernas bajan pegadas a las piernas hasta mitad de la tibia, extendiendo luego la cadera con los glúteos.',
    defaultView: 'lateral',
  },
  'peso-muerto': {
    machineName: 'Plataforma de levantamiento (Deadlift Platform) con barra olímpica y discos bumper',
    machineSetup:
      'Carga la barra olímpica en el suelo con discos de diámetro estándar (45 cm), coloca los pies debajo de modo que la barra cruce la mitad del empeine y agárrala por fuera de las espinillas.',
    description:
      'Se realiza sobre plataforma de levantamiento con barra olímpica desde el suelo. Es un empuje-tirón global: acercas las tibias a la barra, tensas los dorsales, elevas el pecho y extiendes rodillas y cadera al unísono manteniendo la barra pegada al cuerpo.',
    defaultView: 'lateral',
  },
  'peso-muerto-unilateral': {
    machineName: 'Mancuerna individual o kettlebell en zona de peso libre',
    machineSetup:
      'Toma una mancuerna en la mano contraria a la pierna de apoyo; puedes mantenerte cerca de un poste del rack para rozarlo con la mano libre si necesitas equilibrio.',
    description:
      'Se ejecuta en equilibrio sobre una sola pierna mientras el torso y la pierna libre basculan en bloque como un balancín hasta quedar casi paralelos al suelo, trabajando isquiotibiales, glúteo mayor y glúteo medio estabilizador.',
    defaultView: 'lateral',
  },
  'curl-femoral-sentado': {
    machineName: 'Máquina de curl femoral sentado con tope de muslos (Seated Leg Curl Machine)',
    machineSetup:
      'Ajusta el respaldo para alinear tu rodilla con el eje de giro lateral, coloca el rodillo inferior sobre el tendón de Aquiles/gemelo bajo y baja la almohadilla superior hasta bloquear firmemente los muslos.',
    description:
      'Se realiza sentado en la máquina de curl femoral selectorizada. Al partir con la cadera flexionada a 90°, los isquiotibiales trabajan en posición de máximo estiramiento biomecánico al llevar los talones hacia atrás y debajo del asiento.',
    defaultView: 'lateral',
  },
  'curl-femoral-tumbado': {
    machineName: 'Camilla de curl femoral tumbado prono (Lying Prone Leg Curl Machine)',
    machineSetup:
      'Túmbate boca abajo en la camilla angulada dejando las rótulas justo fuera del borde del tapizado y ajusta el rodillo acolchado sobre la parte posterior de los tobillos.',
    description:
      'Se ejecuta boca abajo en la máquina de curl femoral tumbado con pila de placas. Sujetando las agarraderas frontales y manteniendo la pelvis presionada contra el banco, flexionas las rodillas llevando el rodillo hacia los glúteos.',
    defaultView: 'lateral',
  },
  'curl-nordico': {
    machineName: 'Banco de curl nórdico con rodillo sujeta-tobillos (Nordic Hamstring Bench)',
    machineSetup:
      'Arrodíllate sobre la almohadilla del banco nórdico y asegura los tobillos bajo los rodillos traseros acolchados.',
    description:
      'Se realiza en un banco de curl nórdico o soporte fijo de tobillos. Con las rodillas apoyadas y la cadera extendida en línea con el tronco, desciendes el cuerpo hacia delante de forma excéntrica frenando con la fuerza de los isquiotibiales.',
    defaultView: 'lateral',
  },
  'hip-thrust-barra': {
    machineName: 'Banco de Hip Thrust (Glute Bench) + barra olímpica con almohadilla de espuma',
    machineSetup:
      'Apoya la parte inferior de las escápulas contra el borde del banco de Hip Thrust (altura ~40 cm) y coloca la barra olímpica con protector acolchado sobre el pliegue inguinal.',
    description:
      'Se ejecuta apoyando la espalda alta en un banco horizontal y la barra sobre la pelvis. Empujando con los talones y manteniendo las tibias verticales en el punto alto, extiendes la cadera hasta formar una mesa horizontal entre hombros, pelvis y rodillas.',
    defaultView: 'lateral',
  },
  'hip-thrust-maquina': {
    machineName: 'Máquina de Hip Thrust con cinturón o rodillo pélvico (Glute Drive / Belt Hip Thrust Machine)',
    machineSetup:
      'Siéntate en la máquina Glute Drive, apoya las escápulas en el respaldo basculante, abrocha el cinturón acolchado sobre la cadera, apoya los pies en la plataforma inclinada y suelta el seguro.',
    description:
      'Se realiza en la máquina específica de Hip Thrust (Glute Drive), que sustituye la barra libre por un cinturón o rodillo acolchado articulado. Permite cargar los glúteos de forma rápida, cómoda y con máxima estabilidad en todo el recorrido.',
    defaultView: 'lateral',
  },
  'puente-gluteo': {
    machineName: 'Colchoneta de suelo / Tatami acolchado (Glute Bridge Mat)',
    machineSetup:
      'Túmbate boca arriba sobre una colchoneta firme con las rodillas flexionadas y los talones a unos 20–25 cm de los glúteos.',
    description:
      'Se ejecuta en el suelo sin máquina: empujas con los talones para elevar la pelvis hasta alinear rodillas, caderas y hombros, manteniendo una retroversión pélvica y pausa isométrica arriba.',
    defaultView: 'lateral',
  },
  'buenos-dias': {
    machineName: 'Jaula de potencia (Power Rack) con barra olímpica de 20 kg',
    machineSetup:
      'Coloca los soportes del rack a la altura del pecho alto y sube las barras de seguridad a la altura de tu cintura para proteger el final de la bisagra.',
    description:
      'Se realiza dentro del Power Rack con la barra olímpica apoyada sobre el trapecio (como en una sentadilla trasera). Desbloqueas las rodillas y proyectas la cadera hacia atrás inclinando el torso con la columna rígida hasta unos 15–30° sobre la horizontal.',
    defaultView: 'lateral',
  },
  'hiperextension-45': {
    machineName: 'Banco de hiperextensiones lumbar a 45° / Silla Romana (45° Roman Chair / Back Extension)',
    machineSetup:
      'Regula la altura de las almohadillas frontales para que el borde superior quede justo debajo de las crestas ilíacas (dejando libre el pliegue de la cadera) y encaja los talones bajo los rodillos traseros.',
    description:
      'Se realiza en el banco inclinado a 45° (Silla Romana). Con los tobillos fijados y la pelvis apoyada en el cojín, desciendes el tronco flexionando la cadera y subes contrayendo glúteos e isquiotibiales hasta alinear el cuerpo sin hiperextender la columna lumbar.',
    defaultView: 'lateral',
  },
  'swing-kettlebell': {
    machineName: 'Pesa rusa (Kettlebell) de hierro fundido en zona de peso libre',
    machineSetup:
      'Coloca la kettlebell en el suelo unos 30 cm por delante de tus pies separados algo más que el ancho de caderas.',
    description:
      'Se ejecuta con una pesa rusa (kettlebell) sujetada a dos manos. Es una bisagra de cadera balística: llevas la pesa atrás entre los muslos y extiendes cadera y glúteos con potencia para proyectarla al frente hasta la altura del pecho con los brazos relajados como cuerdas.',
    defaultView: 'lateral',
  },
  'patada-gluteo-polea': {
    machineName: 'Torre de polea baja regulable con correa tobillera (Low Cable Pulley + Ankle Strap)',
    machineSetup:
      'Baja el carro de la polea al punto más cercano al suelo, abrocha la tobillera acolchada en tu tobillo de trabajo y engánchala al mosquetón del cable.',
    description:
      'Se realiza frente a una torre de polea baja sujetando la estructura con ambas manos e inclinando ligeramente el tronco. Desde ahí, extiendes la cadera llevando la pierna recta hacia atrás y ligeramente afuera sin arquear la espalda baja.',
    defaultView: 'lateral',
  },
  'abduccion-maquina': {
    machineName: 'Máquina de abducción de cadera sentado (Seated Hip Abductor Machine)',
    machineSetup:
      'Siéntate con la pelvis al fondo del asiento, gira las almohadillas para que queden por la cara EXTERNA de tus rodillas y usa la palanca para cerrar la posición inicial al máximo.',
    description:
      'Se realiza en la máquina selectorizada de abducción de cadera. Con las espinillas apoyadas en los estribos y las almohadillas por fuera de los muslos, empujas las piernas hacia fuera en arco contra la resistencia de las placas para aislar el glúteo medio y menor.',
    defaultView: 'frontal',
  },
  'abduccion-banda': {
    machineName: 'Mini-banda elástica circular de tela o látex (Hip Circle / Glute Loop Band)',
    machineSetup:
      'Coloca la banda circular justo por encima o por debajo de las rodillas y adopta una ligera semiflexión atlética de cadera y rodillas.',
    description:
      'Se realiza con una mini-banda circular alrededor de las piernas, abriendo la rodilla lateralmente contra la tensión elástica mientras la pelvis permanece estable.',
    defaultView: 'frontal',
  },
  'abduccion-polea': {
    machineName: 'Torre de polea baja con correa tobillera acolchada (Cable Hip Abduction)',
    machineSetup:
      'Colócate de perfil a la torre de polea baja, engancha la tobillera en la pierna más alejada de la máquina y sujétate al poste vertical con la mano interna.',
    description:
      'Se ejecuta de pie lateralmente a la torre de polea baja. El cable pasa por delante o detrás del pie de apoyo y la pierna externa se eleva lateralmente en el plano frontal/escapular para trabajar el glúteo medio con tensión constante.',
    defaultView: 'frontal',
  },
  'aduccion-maquina': {
    machineName: 'Máquina de aducción de cadera sentado (Seated Hip Adductor Machine)',
    machineSetup:
      'Siéntate con la espalda apoyada, gira las almohadillas hacia la cara INTERNA de las rodillas y abre los brazos de la máquina con la palanca lateral hasta un ángulo de estiramiento cómodo.',
    description:
      'Se realiza en la máquina de aducción de cadera sentado. Presionando la cara interna de las rodillas contra las almohadillas giratorias, cierras ambas piernas hacia la línea media apretando los aductores 1 segundo antes de abrir de forma controlada.',
    defaultView: 'frontal',
  },
  'plancha-copenhague': {
    machineName: 'Banco plano de musculación + colchoneta de suelo (Copenhagen Adductor Bench)',
    machineSetup:
      'Colócate de costado en el suelo frente a un banco plano; apoya el antebrazo en la colchoneta bajo el hombro y la cara interna de la rodilla/tibia superior sobre el tapizado del banco.',
    description:
      'Se ejecuta apoyando el antebrazo en el suelo y la pierna superior sobre un banco plano. Al elevar la pelvis, el aductor de la pierna superior sostiene todo el peso corporal en contracción isométrica junto con los oblicuos.',
    defaultView: 'lateral',
  },

  // ───────────── PANTORRILLAS ─────────────
  'gemelos-pie-maquina': {
    machineName: 'Máquina de gemelos de pie con hombreras acolchadas (Standing Calf Raise Machine)',
    machineSetup:
      'Regula la altura de las hombreras para que tengas que agacharte ligeramente al entrar, apoya solo el metatarso (la bola del pie) en el borde del escalón y extiende las rodillas.',
    description:
      'Se realiza en la máquina de elevación de talones de pie con carga sobre los hombros. Con las rodillas extendidas (lo que estira el gastrocnemio), bajas los talones por debajo del escalón haciendo una pausa de 1 s y subes de puntillas al máximo recorrido.',
    defaultView: 'lateral',
  },
  'gemelos-sentado': {
    machineName: 'Máquina de sóleo / gemelos sentado con palanca de muslos (Seated Calf Raise Machine)',
    machineSetup:
      'Siéntate, apoya los metatarsos en el borde de la plataforma inferior, ajusta la almohadilla justo encima de las rodillas (en el tercio distal del muslo) y libera la barra de seguridad al subir.',
    description:
      'Se ejecuta en la máquina de gemelos sentado con discos o placas. Al mantener las rodillas flexionadas a 90°, el gastrocnemio queda relajado y toda la carga recae directamente sobre el músculo sóleo.',
    defaultView: 'lateral',
  },
  'gemelos-mancuerna': {
    machineName: 'Escalón o bloque de gemelos antideslizante (Calf Block) + mancuerna individual',
    machineSetup:
      'Coloca un bloque o escalón firme junto a un poste o pared, apoya el metatarso de un pie en el borde y sujeta una mancuerna en la mano del mismo lado.',
    description:
      'Se realiza a una pierna sobre un escalón elevado sujetando una mancuerna del lado que trabaja y rozando un soporte con la mano libre para equilibrarte, recorriendo todo el rango desde el máximo estiramiento del tendón de Aquiles hasta la punta.',
    defaultView: 'lateral',
  },
  'gemelos-peso-corporal': {
    machineName: 'Escalón o bloque de gemelos (Calf Raise Step Block)',
    machineSetup:
      'Apoya la parte anterior de los pies en el borde de un escalón fijo dejando los talones libres en el aire y sujétate suavemente a una barandilla o pared.',
    description:
      'Se realiza en cualquier escalón firme con el propio peso corporal, descendiendo lento hasta estirar la pantorrilla y subiendo al máximo con pausa de 1 segundo arriba.',
    defaultView: 'lateral',
  },

  // ───────────── PECHO ─────────────
  'press-banca-barra': {
    machineName: 'Banco plano olímpico de Press de Banca con soportes (Flat Olympic Bench Press)',
    machineSetup:
      'Túmbate en el banco plano con los ojos justo debajo de la barra olímpica, retrae y deprime las escápulas contra el tapizado, apoya los pies firmes en el suelo y toma un agarre 1,5 veces el ancho de hombros.',
    description:
      'Se realiza en el banco plano olímpico con barra de 20 kg. Sacas la barra de los soportes con los brazos bloqueados, desciendes de forma controlada hasta tocar la línea inferior del pectoral con los codos a 45–60° del tronco y empujas hacia arriba y ligeramente atrás.',
    defaultView: 'lateral',
  },
  'press-banca-mancuernas': {
    machineName: 'Banco plano horizontal de musculación + par de mancuernas (Flat Dumbbell Bench)',
    machineSetup:
      'Siéntate en el extremo del banco plano con las mancuernas sobre los muslos y túmbate hacia atrás impulsándolas con las rodillas hasta situarlas a los lados del pecho.',
    description:
      'Se ejecuta tumbado en un banco plano con una mancuerna en cada mano. A diferencia de la barra, las mancuernas permiten un mayor rango de estiramiento abajo y un arco convergente arriba para contraer al máximo las fibras esternales del pectoral.',
    defaultView: 'lateral',
  },
  'press-inclinado-mancuernas': {
    machineName: 'Banco regulable inclinado a 30° + par de mancuernas (Incline Adjustable Bench)',
    machineSetup:
      'Regula el respaldo del banco a 30° (segundo o tercer punto de anclaje) y sube el asiento pequeño unos 15° para no resbalar hacia abajo.',
    description:
      'Se realiza en un banco inclinado a 30° con mancuernas. La inclinación alinea el empuje con las fibras claviculares (pectoral superior) y el deltoides anterior, bajando las mancuernas a los lados del pecho alto con los codos ligeramente metidos.',
    defaultView: 'lateral',
  },
  'press-inclinado-smith': {
    machineName: 'Máquina Multipower / Smith Machine + banco regulable inclinado a 30°',
    machineSetup:
      'Centra un banco inclinado a 30° bajo la barra guiada de la Multipower de forma que al bajar la barra toque la parte alta del pecho (dos dedos bajo las clavículas) y fija los topes de seguridad.',
    description:
      'Se ejecuta combinando un banco a 30° con la barra guiada de la Multipower. Al eliminar la necesidad de equilibrar la barra, permite exprimir el pectoral superior con bajadas lentas y controladas hasta cerca del fallo.',
    defaultView: 'lateral',
  },
  'press-pecho-maquina': {
    machineName: 'Máquina de press de pecho sentado convergente (Seated Chest Press Machine)',
    machineSetup:
      'Ajusta la altura del asiento para que las empuñaduras queden exactamente a la línea media/baja del pectoral y regula la profundidad inicial de los brazos para sentir un estiramiento cómodo sin forzar el hombro.',
    description:
      'Se realiza sentado en la máquina de press pectoral con torre de placas o carga de discos (tipo Hammer Strength). Con la espalda y escápulas fijas contra el respaldo, empujas las palancas hacia delante en trayectoria convergente.',
    defaultView: 'lateral',
  },
  'cruce-poleas': {
    machineName: 'Torre doble de cruce de poleas regulable (Dual Adjustable Pulley / Cable Crossover)',
    machineSetup:
      'Fija ambas poleas a la altura de los hombros (o un punto más arriba para enfatizar las fibras medias/inferiores), coloca un maneral estribo en cada cable y da un paso al frente en tijera para tensar.',
    description:
      'Se ejecuta en el centro de una estación doble de cruce de poleas. Con el tronco firme y los codos en semiflexión constante, describes un arco amplio hacia delante hasta juntar las manos frente al esternón manteniendo tensión continua en todo el recorrido.',
    defaultView: 'frontal',
  },
  'contractor-pecho': {
    machineName: 'Máquina contractora de pectoral sentado (Pec Deck / Butterfly Machine)',
    machineSetup:
      'Regula el asiento para que tus manos y codos queden ligeramente por debajo de la línea de los hombros, y coloca los brazos móviles de la máquina en un punto de apertura que estire el pecho sin llevar los codos muy atrás.',
    description:
      'Se realiza sentado en la máquina Pec Deck (contractora). Con la espalda pegada al respaldo, cierras ambos brazos en un arco horizontal frente al pecho, pausas 1 segundo apretando los pectorales y abres lento resistiendo las placas.',
    defaultView: 'frontal',
  },
  'aperturas-mancuernas': {
    machineName: 'Banco plano horizontal de musculación + par de mancuernas (Dumbbell Chest Fly)',
    machineSetup:
      'Túmbate en el banco plano con dos mancuernas ligeras sobre el pecho, palmas enfrentadas (agarre neutro) y codos flexionados unos 15–20°.',
    description:
      'Se realiza tumbado en banco plano abriendo las mancuernas hacia los lados en un arco amplio como si abrazaras un barril, manteniendo fijo el ángulo de los codos para trabajar el pectoral en estiramiento.',
    defaultView: 'lateral',
  },
  'flexiones': {
    machineName: 'Colchoneta o suelo firme antideslizante (Push-Up Floor Station)',
    machineSetup:
      'Apoya las manos en el suelo un poco más abiertas que los hombros con los dedos abiertos y extiende las piernas apoyando las puntas de los pies.',
    description:
      'Se ejecuta en el suelo con el propio peso corporal. Manteniendo abdomen y glúteos contraídos para que el cuerpo forme una tabla rígida, flexionas los codos a 45° hasta rozar el suelo con el pecho y empujas hasta extender.',
    defaultView: 'lateral',
  },
  'flexiones-inclinadas': {
    machineName: 'Banco plano estable o barra fija en Power Rack a media altura (Incline Push-Up)',
    machineSetup:
      'Apoya las manos en el borde de un banco plano fijo o sobre una barra bloqueada en el Power Rack a la altura de la cadera o cintura.',
    description:
      'Se realiza apoyando las manos en una superficie elevada (banco o barra en rack) y los pies en el suelo. Al reducir el porcentaje de peso corporal que soportan los brazos, es la progresión ideal para dominar la técnica de empuje.',
    defaultView: 'lateral',
  },
  'flexiones-cerradas': {
    machineName: 'Colchoneta o suelo firme antideslizante (Close-Grip Push-Up)',
    machineSetup:
      'Coloca las manos en el suelo directamente debajo de los hombros (o ligeramente más cerradas) con los codos apuntando hacia los pies.',
    description:
      'Se ejecuta en el suelo con agarre estrecho: al bajar manteniendo los brazos pegados a las costillas, se maximiza la flexión del codo y el trabajo conjunto de los tríceps y la porción interna del pectoral.',
    defaultView: 'lateral',
  },
  'fondos-paralelas': {
    machineName: 'Estación de fondos en barras paralelas (Parallel Dip Bars / Dip Tower)',
    machineSetup:
      'Ajusta las barras paralelas (si son convergentes, elige la anchura ligeramente superior a tus caderas), sujétalas con agarre neutro y súbete a los estribos para iniciar con los brazos extendidos.',
    description:
      'Se realiza suspendido en las barras paralelas de una torre de fondos. Inclinando el torso unos 15–20° hacia delante para enfatizar el pectoral, flexionas los codos hasta que los hombros bajan a su nivel y empujas hasta bloquear arriba.',
    defaultView: 'lateral',
  },
  'fondos-banco': {
    machineName: 'Banco plano horizontal de musculación (Bench Triceps Dip)',
    machineSetup:
      'Siéntate en el borde largo de un banco plano, apoya el talón de las manos junto a tus caderas y adelanta los pies apoyando los talones en el suelo.',
    description:
      'Se ejecuta usando un banco plano como soporte trasero para las manos: deslizas los glúteos justo por delante del borde del banco, bajas flexionando los codos hacia atrás hasta 90° y empujas extendiendo los tríceps.',
    defaultView: 'lateral',
  },
  'press-pecho-banda': {
    machineName: 'Banda elástica de resistencia anclada a poste o Power Rack (Band Chest Press)',
    machineSetup:
      'Ancla el punto medio de la banda elástica a una columna o rack a la altura del pecho, sujeta ambos extremos de espaldas al anclaje y da un paso adelante.',
    description:
      'Se realiza de pie de espaldas al punto de anclaje de una banda elástica, empujando ambas manos al frente a la altura del esternón contra la tensión progresiva del látex.',
    defaultView: 'lateral',
  },

  // ───────────── ESPALDA ─────────────
  'dominadas': {
    machineName: 'Barra fija alta de dominadas en jaula o torre (Overhead Pull-Up Bar)',
    machineSetup:
      'Usa un escalón para alcanzar la barra con un agarre prono (palmas al frente) un poco más ancho que los hombros y cuélgate con los brazos totalmente extendidos.',
    description:
      'Se realiza colgado de una barra fija superior. Inicias deprimiendo las escápulas (alejando los hombros de las orejas) y tiras llevando los codos hacia abajo y a los costados hasta que la barbilla o la parte alta del pecho supera la barra.',
    defaultView: 'espalda',
  },
  'dominadas-asistidas': {
    machineName: 'Máquina de dominadas y fondos asistida por contrapeso (Assisted Pull-Up / Gravitron Machine)',
    machineSetup:
      'Selecciona en la pila de placas el peso de ayuda (en esta máquina, más peso en las placas = más ayuda), sube por los peldaños, apoya las rodillas o pies en la plataforma acolchada y sujeta la barra superior.',
    description:
      'Se ejecuta en la máquina Gravitron de dominadas asistidas, cuya plataforma empuja tus rodillas hacia arriba con un contrapeso regulable. Permite realizar el recorrido completo de la dominada con técnica estricta de dorsal ancho.',
    defaultView: 'espalda',
  },
  'dominadas-supinas': {
    machineName: 'Barra fija alta de dominadas (Chin-Up Bar)',
    machineSetup:
      'Sujeta la barra fija con agarre supino (palmas mirando hacia ti) a una distancia igual o ligeramente menor al ancho de los hombros.',
    description:
      'Se realiza en la barra de dominadas con las palmas hacia ti (chin-up). Este agarre coloca al bíceps braquial en su línea óptima de fuerza y lleva los codos pegados al tronco para estirar y contraer al máximo el dorsal ancho.',
    defaultView: 'espalda',
  },
  'jalon-pecho': {
    machineName: 'Torre de polea alta con asiento y rodillos sujeta-muslos (Lat Pulldown Machine)',
    machineSetup:
      'Engancha la barra larga curva al mosquetón de la polea alta, ajusta la altura de los rodillos acolchados para que sujeten tus muslos sin holgura al sentarte y toma un agarre prono medio-ancho.',
    description:
      'Se realiza sentado en la máquina de jalón al pecho (Lat Pulldown). Con los muslos bloqueados bajo los rodillos y una ligera extensión torácica (~10–15°), tiras de la barra hacia la parte superior del esternón llevando los codos hacia abajo.',
    defaultView: 'espalda',
  },
  'jalon-neutro': {
    machineName: 'Torre de polea alta con rodillos de muslos + maneral neutro o triángulo en V (Close-Grip Lat Pulldown)',
    machineSetup:
      'Coloca el accesorio de agarre neutro paralelo (maneral en V o barra MAG estrecha) en la polea alta y asegura tus muslos bajo los rodillos del asiento.',
    description:
      'Se ejecuta en la estación de jalón alto usando un agarre neutro con las palmas enfrentadas. Al bajar los codos por delante del torso rozando las costillas, enfatiza las fibras inferiores del dorsal ancho con una posición muy ergonómica para hombros y muñecas.',
    defaultView: 'lateral',
  },
  'jalon-brazos-rectos': {
    machineName: 'Torre de polea alta regulable con barra recta corta o cuerda (Straight-Arm Cable Pulldown)',
    machineSetup:
      'Sitúa la polea en el punto más alto, engancha una barra recta corta o cuerda doble, toma el agarre y da dos pasos atrás inclinando el torso unos 20–30°.',
    description:
      'Se realiza de pie frente a una polea alta manteniendo los codos casi extendidos y bloqueados. Llevas la barra en un arco amplio desde la altura de la frente hasta tocar la cara frontal de los muslos aislando exclusivamente el dorsal ancho.',
    defaultView: 'lateral',
  },
  'remo-polea-sentado': {
    machineName: 'Estación de remo bajo en polea con banco largo y plataforma de pies (Seated Cable Row Machine)',
    machineSetup:
      'Engancha el maneral triángulo en V (o barra neutra) a la polea baja, apoya los pies en las plataformas frontales con las rodillas semiflexionadas y siéntate erguido con la columna neutra.',
    description:
      'Se ejecuta sentado en la máquina de remo en polea baja (Gironda). Tiras del maneral hacia la parte baja del abdomen llevando los codos hacia atrás y juntando las escápulas, y regresas extendiendo los brazos sin encorvar la zona lumbar.',
    defaultView: 'lateral',
  },
  'remo-maquina': {
    machineName: 'Máquina de remo sentado con apoyo pectoral (Chest-Supported Row Machine)',
    machineSetup:
      'Regula la altura del asiento para que la parte superior del cojín pectoral quede a la altura del esternón medio y ajusta la distancia del cojín para que alcances las asas con las escápulas estiradas.',
    description:
      'Se realiza en la máquina de remo con apoyo en el pecho (con placas o discos). Al descansar el torso contra la almohadilla frontal, elimina por completo la fatiga lumbar y permite traccionar con máxima intensidad hacia dorsal y espalda media.',
    defaultView: 'lateral',
  },
  'remo-mancuernas-banco': {
    machineName: 'Banco regulable inclinado a 30–45° + par de mancuernas (Incline Bench Dumbbell Row)',
    machineSetup:
      'Inclina el respaldo de un banco regulable a 30–45°, apoya el pecho y el abdomen boca abajo sobre el tapizado con los pies firmes en el suelo y deja colgar una mancuerna en cada mano.',
    description:
      'Se ejecuta tumbado boca abajo sobre un banco inclinado sujetando dos mancuernas. Con el tronco totalmente estabilizado por el respaldo, remas llevando los codos hacia la cadera y retrayendo las escápulas.',
    defaultView: 'lateral',
  },
  'remo-barra': {
    machineName: 'Zona de peso libre o Power Rack con barra olímpica de 20 kg (Barbell Bent-Over Row)',
    machineSetup:
      'Coloca la barra en los soportes bajos del rack (a la altura de las rodillas) o en el suelo con discos olímpicos y sujétala con agarre prono algo más ancho que los hombros.',
    description:
      'Se realiza en peso libre inclinando el torso en bisagra de cadera a unos 45° con las rodillas semiflexionadas y el core firme. Desde los brazos colgando en vertical, tiras de la barra hacia el ombligo apretando romboides, trapecio medio y dorsales.',
    defaultView: 'lateral',
  },
  'remo-mancuerna': {
    machineName: 'Banco plano horizontal de musculación + mancuerna individual (One-Arm Dumbbell Row)',
    machineSetup:
      'Coloca una mancuerna junto a un banco plano; apoya la mano y la rodilla libres sobre el banco manteniendo la espalda horizontal y el pie de trabajo firme en el suelo.',
    description:
      'Se ejecuta de forma unilateral apoyando tres puntos (mano, rodilla y pie contrario) en un banco plano. Tiras de la mancuerna en trayectoria curva desde la vertical del hombro hacia el bolsillo de la cadera para maximizar el trabajo del dorsal.',
    defaultView: 'lateral',
  },
  'remo-invertido': {
    machineName: 'Barra baja en Multipower / Power Rack o anillas de suspensión (Inverted Bodyweight Row)',
    machineSetup:
      'Fija la barra de la Multipower o del Power Rack a la altura de tu cintura o cadera, métete debajo boca arriba, sujeta la barra y apoya los talones en el suelo con el cuerpo recto.',
    description:
      'Se realiza colgado horizontalmente debajo de una barra fija a media altura (en Multipower o Rack). Manteniendo glúteos y abdomen firmes como una plancha invertida, traccionas hasta tocar la barra con la línea baja del pecho.',
    defaultView: 'lateral',
  },
  'remo-banda': {
    machineName: 'Banda elástica larga anclada a los pies o a un poste bajo (Seated Resistance Band Row)',
    machineSetup:
      'Siéntate en el suelo con las piernas extendidas (ligeramente flexionadas), pasa el centro de la banda elástica por las plantas de los pies y sujeta ambos extremos con el torso erguido.',
    description:
      'Se ejecuta sentado pasando una banda elástica por los pies o un anclaje bajo, tirando de las manos hacia las costillas bajas mientras juntas las escápulas.',
    defaultView: 'lateral',
  },
  'encogimientos': {
    machineName: 'Par de mancuernas hexagonales pesadas en zona de peso libre (Dumbbell Shrugs)',
    machineSetup:
      'Sujeta dos mancuernas pesadas a los costados con agarre neutro (o usa straps de muñeca para que el agarre no limite al trapecio) y mantén los brazos rectos.',
    description:
      'Se realiza de pie con mancuernas a los lados del cuerpo. Sin doblar los codos, elevas los hombros en vertical y ligeramente hacia atrás en dirección a las orejas, manteniendo la contracción máxima del trapecio superior durante 1 segundo.',
    defaultView: 'espalda',
  },

  // ───────────── HOMBROS ─────────────
  'press-militar': {
    machineName: 'Jaula de potencia (Power Rack) con barra olímpica de 20 kg (Standing Overhead Barbell Press)',
    machineSetup:
      'Ajusta los soportes J-cups del Power Rack a la altura del esternón superior, toma un agarre justo por fuera de los hombros y saca la barra apoyándola sobre las clavículas y deltoides frontales.',
    description:
      'Se realiza de pie frente al Power Rack con barra olímpica. Con glúteos, cuádriceps y abdomen contraídos para blindar la columna, empujas la barra en línea vertical por delante de la cara y metes ligeramente la cabeza al bloquear los brazos sobre los hombros.',
    defaultView: 'lateral',
  },
  'press-hombro-mancuernas': {
    machineName: 'Banco regulable con respaldo vertical a 80–85° + par de mancuernas (Seated Dumbbell Shoulder Press)',
    machineSetup:
      'Coloca el respaldo del banco regulable casi vertical (a 80–85°, un punto antes de 90°), siéntate con la espalda bien apoyada y sube las mancuernas a la altura de las orejas con ayuda de las rodillas.',
    description:
      'Se ejecuta sentado en un banco con respaldo alto sujetando dos mancuernas. Empujas ambas pesas en trayectoria ligeramente convergente sobre la cabeza con los codos adelantados unos 20–30° en el plano escapular.',
    defaultView: 'frontal',
  },
  'press-hombro-maquina': {
    machineName: 'Máquina de press de hombros sentado convergente (Seated Overhead Shoulder Press Machine)',
    machineSetup:
      'Regula la altura del asiento para que las empuñaduras en reposo queden a la altura de tus hombros/mandíbula y elige entre el agarre prono ancho o el agarre neutro frontal.',
    description:
      'Se realiza sentado en la máquina selectorizada o de palanca de press de hombros. Al tener la espalda fija contra el respaldo y la trayectoria guiada, permite trabajar el deltoides anterior y lateral con total estabilidad.',
    defaultView: 'frontal',
  },
  'flexiones-pica': {
    machineName: 'Colchoneta o suelo antideslizante (Pike Push-Up Floor Station)',
    machineSetup:
      'Adopta posición de flexión y camina con los pies hacia las manos elevando la cadera hasta que tu cuerpo forme una "V" invertida.',
    description:
      'Se realiza en el suelo con el cuerpo en V invertida para trasladar el peso corporal sobre la cintura escapular. Flexionas los codos bajando la coronilla hacia un punto por delante de las manos (formando un triángulo) y empujas en vertical.',
    defaultView: 'lateral',
  },
  'elevaciones-laterales': {
    machineName: 'Par de mancuernas en zona de peso libre (Standing Dumbbell Lateral Raise)',
    machineSetup:
      'Toma dos mancuernas ligeras o moderadas, separa los pies al ancho de cadera e inclina el tronco unos 10° hacia delante manteniendo los brazos ligeramente por delante de los muslos.',
    description:
      'Se ejecuta de pie con mancuernas: con los codos en semiflexión fija, elevas los brazos hacia los lados y ligeramente al frente (plano escapular, ~20–30°) hasta la altura de los hombros sin encoger el trapecio.',
    defaultView: 'frontal',
  },
  'elevaciones-laterales-polea': {
    machineName: 'Torre de polea baja regulable con maneral estribo individual (Single-Arm Cable Lateral Raise)',
    machineSetup:
      'Sitúa la polea a la altura de la tibia o de la muñeca, engancha un maneral individual, ponte de perfil a la torre y sujeta el poste vertical con la mano cercana.',
    description:
      'Se realiza de forma unilateral junto a una polea baja. El cable proporciona resistencia máxima desde el inicio del movimiento (cuando el brazo cruza delante de la cadera) hasta llegar a la horizontal del hombro.',
    defaultView: 'frontal',
  },
  'elevaciones-laterales-maquina': {
    machineName: 'Máquina de elevaciones laterales sentado con almohadillas de brazo (Seated Lateral Raise Machine)',
    machineSetup:
      'Ajusta la altura del asiento para que la articulación de tu hombro coincida con el pivote superior de la máquina y apoya la cara externa de los codos y antebrazos contra los cojines laterales.',
    description:
      'Se realiza en la máquina específica de elevaciones laterales. Al aplicar la fuerza directamente con los codos contra las almohadillas acolchadas, elimina la tensión de agarre y muñeca y aísla de forma pura el deltoides lateral.',
    defaultView: 'frontal',
  },
  'elevaciones-laterales-banda': {
    machineName: 'Banda elástica larga de resistencia pisada bajo los pies (Band Lateral Raise)',
    machineSetup:
      'Pisa la parte central de la banda elástica con uno o ambos pies (ajusta la separación de pies para regular la tensión inicial) y sujeta los extremos a los costados.',
    description:
      'Se ejecuta de pie pisando una banda elástica y abduciendo ambos brazos hasta los 90° con control especial en la fase de bajada.',
    defaultView: 'frontal',
  },
  'face-pull': {
    machineName: 'Torre de polea alta/media regulable con cuerda doble de tríceps (Cable Rope Face Pull)',
    machineSetup:
      'Fija el carro de la polea a la altura de los ojos o la frente, engancha la cuerda doble, sujeta los topes con los pulgares apuntando hacia atrás y da dos pasos atrás.',
    description:
      'Se realiza frente a una polea alta con cuerda doble. Tiras del centro de la cuerda hacia la frente mientras separas las manos hacia las orejas con los codos altos y en rotación externa, fortaleciendo deltoides posterior, trapecio medio y manguito rotador.',
    defaultView: 'espalda',
  },
  'face-pull-banda': {
    machineName: 'Banda elástica anclada a poste alto a la altura del rostro (Band Face Pull)',
    machineSetup:
      'Rodea un poste vertical o barra del rack a la altura de tu cara con una banda elástica y sujeta ambos lados con las palmas enfrentadas.',
    description:
      'Se ejecuta tirando de una banda elástica anclada en alto hacia la frente con los codos elevados y rotando los hombros hacia fuera al final del recorrido.',
    defaultView: 'espalda',
  },
  'pajaros-maquina': {
    machineName: 'Máquina Rear Delt / Contractora Pec Deck en posición invertida (Reverse Pec Deck Machine)',
    machineSetup:
      'Coloca los brazos móviles de la máquina Pec Deck en la posición más adelantada (cerrada al fondo), ajusta el asiento para que las asas horizontales queden a la altura de tus hombros y siéntate mirando hacia el respaldo apoyando el pecho en él.',
    description:
      'Se realiza sentado de cara al respaldo en la máquina contractora dual (Rear Delt / Pec Deck). Con el pecho apoyado en el cojín y los brazos casi extendidos, abres las palancas hacia atrás en un arco horizontal para aislar el deltoides posterior.',
    defaultView: 'espalda',
  },
  'pajaros-mancuernas': {
    machineName: 'Par de mancuernas ligeras en zona de peso libre o banco inclinado (Bent-Over Dumbbell Rear Delt Fly)',
    machineSetup:
      'Toma dos mancuernas ligeras e inclina el torso en bisagra hasta casi la horizontal (o apoya el pecho boca abajo en un banco inclinado a 30° para mayor estabilidad).',
    description:
      'Se ejecuta con el tronco inclinado hacia delante y una mancuerna en cada mano colgando bajo los hombros. Abres los brazos hacia fuera en arco manteniendo una ligera flexión de codos hasta alinearlos con la espalda.',
    defaultView: 'espalda',
  },

  // ───────────── BRAZOS ─────────────
  'curl-barra': {
    machineName: 'Barra Z (EZ Curl Bar) o barra olímpica recta en zona de peso libre',
    machineSetup:
      'Carga una barra Z (cuyos ángulos protegen las muñecas) o barra recta y sujétala de pie con agarre supino (palmas arriba) al ancho de los hombros.',
    description:
      'Se realiza de pie con barra Z o barra olímpica. Manteniendo los brazos pegados al torso y los hombros fijos atrás, flexionas los codos describiendo un semicírculo hasta la altura del pecho alto y desciendes en 2–3 segundos hasta estirar por completo.',
    defaultView: 'lateral',
  },
  'curl-mancuernas': {
    machineName: 'Par de mancuernas en zona de peso libre o banco vertical (Dumbbell Biceps Curl)',
    machineSetup:
      'Colócate de pie (o sentado en un banco con respaldo a 85°) con una mancuerna en cada mano colgando a los costados.',
    description:
      'Se ejecuta con mancuernas partiendo con agarre neutro a los lados del muslo y supinando la muñeca (girando la palma hacia arriba y afuera) a medida que flexionas el codo para activar las dos funciones del bíceps braquial.',
    defaultView: 'frontal',
  },
  'curl-martillo': {
    machineName: 'Par de mancuernas hexagonales en zona de peso libre (Hammer Curl)',
    machineSetup:
      'Sujeta dos mancuernas a los costados con las palmas mirándose entre sí (agarre neutro de martillo) y pega la cara interna de los brazos a las costillas.',
    description:
      'Se realiza de pie o sentado flexionando los codos con las mancuernas en posición vertical (agarre neutro constante). Esta orientación enfatiza el músculo braquial anterior y el braquiorradial del antebrazo.',
    defaultView: 'lateral',
  },
  'curl-predicador-maquina': {
    machineName: 'Máquina de curl predicador / Banco Scott con placas o palanca (Preacher Curl Machine)',
    machineSetup:
      'Ajusta la altura del asiento para que las axilas encajen exactamente sobre el borde superior del cojín inclinado (Banco Scott) y toda la parte posterior de los brazos descanse sobre el tapizado.',
    description:
      'Se realiza en la máquina de curl predicador (Banco Scott). El apoyo inclinado bloquea cualquier movimiento del hombro o balanceo del torso, obligando al bíceps a realizar el 100 % de la flexión desde el estiramiento.',
    defaultView: 'lateral',
  },
  'curl-bayesiano': {
    machineName: 'Torre de polea baja regulable con maneral estribo individual (Bayesian Cable Curl)',
    machineSetup:
      'Coloca la polea a la altura de la mano o la rodilla, engancha un maneral individual, ponte DE ESPALDAS a la torre y da un paso largo al frente para que el brazo quede extendido detrás del torso.',
    description:
      'Se realiza de espaldas a una polea baja. Al situar el hombro en extensión (con el codo ligeramente detrás de la línea de las costillas), trabaja la cabeza larga del bíceps en su posición de máximo estiramiento biomecánico.',
    defaultView: 'lateral',
  },
  'curl-polea': {
    machineName: 'Torre de polea baja con barra corta giratoria o cuerda doble (Low Cable Biceps Curl)',
    machineSetup:
      'Sitúa el carro de la polea en el punto más bajo, engancha la barra recta/Z corta con rodamiento giratorio o la cuerda doble y colócate de pie a medio paso de la torre.',
    description:
      'Se ejecuta de pie frente a una polea baja: al traccionar de un cable en lugar de un peso libre vertical, la tensión sobre el bíceps se mantiene constante tanto abajo como en la contracción máxima arriba.',
    defaultView: 'lateral',
  },
  'curl-banda': {
    machineName: 'Banda elástica larga pisada bajo los pies (Resistance Band Biceps Curl)',
    machineSetup:
      'Pisa el centro de la banda con ambos pies al ancho de cadera y toma los extremos con las palmas hacia arriba.',
    description:
      'Se realiza de pie pisando una banda elástica y flexionando los codos pegados al cuerpo hasta los hombros con pausa de 1 segundo en la cima.',
    defaultView: 'frontal',
  },
  'extension-triceps-polea': {
    machineName: 'Torre de polea alta con cuerda doble o barra corta en V (Cable Triceps Pushdown)',
    machineSetup:
      'Fija la polea en la posición más alta de la torre, engancha la cuerda doble o barra corta, pega los codos a los costados e inclina el tronco unos 10–15° hacia delante.',
    description:
      'Se realiza de pie frente a la estación de polea alta. Con los húmeros inmóviles a los lados del torso, extiendes los antebrazos hacia abajo hasta bloquear los codos (abriendo los extremos de la cuerda al final) y subes lento hasta 90°.',
    defaultView: 'lateral',
  },
  'extension-triceps-overhead-polea': {
    machineName: 'Torre de polea media/alta con cuerda doble (Overhead Cable Triceps Extension)',
    machineSetup:
      'Sitúa la polea a la altura de la cabeza o la cadera, engancha la cuerda doble, sujétala por encima de los hombros dándole la espalda a la torre y adelanta un pie en tijera.',
    description:
      'Se ejecuta de espaldas a la torre de poleas con los brazos elevados y los codos apuntando hacia delante y arriba. Al extender los antebrazos por encima de la cabeza con el hombro flexionado, la cabeza larga del tríceps trabaja en máximo estiramiento.',
    defaultView: 'lateral',
  },
  'extension-overhead-mancuerna': {
    machineName: 'Banco con respaldo corto vertical + mancuerna a dos manos (Seated Overhead Dumbbell Extension)',
    machineSetup:
      'Siéntate en un banco con respaldo vertical corto, eleva una mancuerna sobre la cabeza y sujeta la cara interna del disco superior con ambas palmas formando un diamante.',
    description:
      'Se realiza sentado (copa de tríceps) sosteniendo una mancuerna vertical con ambas manos detrás de la nuca: bajas la pesa flexionando solo los codos apuntando al techo y extiendes hasta bloquear arriba.',
    defaultView: 'lateral',
  },
  'press-frances': {
    machineName: 'Banco plano de musculación + barra Z (EZ-Bar Lying Triceps Extension / Skull Crusher)',
    machineSetup:
      'Túmbate boca arriba en un banco plano sujetando una barra Z con agarre prono estrecho y lleva los brazos a la vertical con una ligera inclinación de 15° hacia atrás (hacia la cabeza).',
    description:
      'Se ejecuta tumbado en banco plano con barra Z. Manteniendo los brazos inclinados ligeramente hacia atrás para no perder tensión arriba, flexionas los codos bajando la barra hacia la frente o detrás de la coronilla y extiendes los tríceps.',
    defaultView: 'lateral',
  },
  'extension-triceps-banda': {
    machineName: 'Banda elástica anclada en punto alto de rack o puerta (Band Triceps Pushdown)',
    machineSetup:
      'Pasa la banda elástica por la barra superior del rack o un anclaje alto de puerta y sujeta ambos lados con los codos pegados a las costillas.',
    description:
      'Se realiza frente a una banda anclada en alto, extendiendo los codos hacia abajo hasta el bloqueo completo con pausa de 1 segundo.',
    defaultView: 'lateral',
  },
  'curl-muneca': {
    machineName: 'Banco plano horizontal de musculación + par de mancuernas o barra corta (Seated Wrist Curl)',
    machineSetup:
      'Siéntate en un banco plano, apoya la cara posterior de los antebrazos sobre tus muslos (o sobre el borde del banco) dejando que las muñecas sobresalgan con las palmas hacia arriba.',
    description:
      'Se realiza sentado apoyando los antebrazos sobre los muslos o un banco plano: dejas rodar la mancuerna hacia los dedos extendiendo la muñeca y luego la flexionas al máximo para fortalecer los flexores del antebrazo.',
    defaultView: 'lateral',
  },
  'paseo-granjero': {
    machineName: 'Par de mancuernas pesadas o barras Farmer Walk Handles en pasillo libre',
    machineSetup:
      'Coloca dos mancuernas pesadas (o barras de paseo del granjero) en el suelo a los lados de tus pies, agáchate en sentadilla con espalda neutra para tomarlas y ponte de pie.',
    description:
      'Se ejecuta caminando por un pasillo despejado con cargas pesadas en ambas manos, pecho alto, hombros retraídos (sin dejar que caigan) y pasos cortos y firmes para desarrollar agarre, trapecios y estabilidad de core.',
    defaultView: 'frontal',
  },

  // ───────────── CORE ─────────────
  'plancha': {
    machineName: 'Colchoneta de suelo / Tatami acolchado (Abdominal Floor Mat)',
    machineSetup:
      'Coloca los antebrazos paralelos sobre una colchoneta con los codos exactamente debajo de los hombros y las puntas de los pies apoyadas al ancho de cadera.',
    description:
      'Se realiza en colchoneta manteniendo el cuerpo en línea recta isométrica. Aplica una ligera retroversión pélvica (apretando glúteos y acercando pubis a costillas) mientras empujas el suelo con los codos.',
    defaultView: 'lateral',
  },
  'plancha-lateral': {
    machineName: 'Colchoneta de suelo / Tatami acolchado (Side Plank Floor Mat)',
    machineSetup:
      'Túmbate de lado sobre la colchoneta apoyando el antebrazo perpendicular al cuerpo con el codo justo debajo del hombro y un pie sobre el otro (o en tijera).',
    description:
      'Se ejecuta en colchoneta elevando la cadera de costado hasta formar una línea diagonal recta desde la cabeza hasta los tobillos para trabajar de forma isométrica los oblicuos y el glúteo medio inferior.',
    defaultView: 'lateral',
  },
  'crunch': {
    machineName: 'Colchoneta de suelo / Tatami acolchado (Abdominal Floor Mat)',
    machineSetup:
      'Túmbate boca arriba en la colchoneta con las rodillas flexionadas a 90°, las plantas de los pies apoyadas y las yemas de los dedos rozando las sienes.',
    description:
      'Se realiza en el suelo enrollando la columna dorsal (flexión espinal) para acercar las costillas hacia la pelvis mientras la zona lumbar permanece pegada a la colchoneta.',
    defaultView: 'lateral',
  },
  'crunch-polea': {
    machineName: 'Torre de polea alta con cuerda doble + almohadilla para rodillas (Kneeling Cable Crunch)',
    machineSetup:
      'Coloca la polea arriba con la cuerda doble, arrodíllate sobre una colchoneta a unos 50 cm de la torre y sujeta los extremos de la cuerda junto a las sienes o la frente.',
    description:
      'Se ejecuta de rodillas frente a una polea alta con cuerda. Manteniendo la cadera fija en el mismo sitio y los brazos pegados a la cabeza, flexionas la columna vertebral llevando los codos hacia las rodillas contra el peso de las placas.',
    defaultView: 'lateral',
  },
  'crunch-maquina': {
    machineName: 'Máquina de crunch abdominal sentado con placas (Seated Abdominal Crunch Machine)',
    machineSetup:
      'Ajusta el asiento para que tu ombligo quede alineado con el eje de giro lateral de la máquina, coloca los pies bajo los rodillos inferiores y sujeta las asas superiores junto a los hombros.',
    description:
      'Se realiza sentado en la máquina selectorizada de abdominales. Sin empujar con los brazos, enrollas el esternón hacia la pelvis venciendo la resistencia de las placas y regresas despacio sin que las pesas choquen.',
    defaultView: 'lateral',
  },
  'elevacion-piernas-colgado': {
    machineName: 'Barra fija alta de dominadas o Silla Romana con coderas (Pull-Up Bar / Captain’s Chair)',
    machineSetup:
      'Cuélgate de una barra alta de dominadas con agarre firme (o apoya los antebrazos y la espalda en una Silla Romana vertical / Captain’s Chair).',
    description:
      'Se realiza suspendido de una barra de dominadas o en silla romana vertical. El movimiento clave no es solo subir los muslos (psoas), sino bascular y enrollar la pelvis hacia arriba al final para contraer el recto abdominal.',
    defaultView: 'lateral',
  },
  'dead-bug': {
    machineName: 'Colchoneta de suelo / Tatami acolchado (Floor Core Mat)',
    machineSetup:
      'Túmbate boca arriba en la colchoneta, aplasta la zona lumbar contra el suelo, eleva los brazos rectos hacia el techo y coloca caderas y rodillas a 90°.',
    description:
      'Se ejecuta en el suelo extendiendo de forma lenta y simultánea un brazo hacia atrás y la pierna contraria hacia delante a pocos centímetros del suelo sin que la espalda baja pierda nunca el contacto con la colchoneta.',
    defaultView: 'lateral',
  },
  'pallof': {
    machineName: 'Torre de polea regulable a altura pectoral con maneral estribo (Cable Pallof Press Station)',
    machineSetup:
      'Sitúa el carro de la polea a la altura del esternón, engancha un maneral individual, ponte de perfil a la torre, sujeta el maneral con ambas manos pegado al pecho y aléjate dos pasos laterales para tensar.',
    description:
      'Se realiza de pie y de perfil a una polea regulable a media altura. Al extender los brazos al frente alejando el maneral del esternón, el brazo de palanca aumenta y los oblicuos y transverso abdominal trabajan al máximo para impedir que el cable te gire.',
    defaultView: 'frontal',
  },
  'pallof-banda': {
    machineName: 'Banda elástica anclada a columna o rack a altura pectoral (Band Pallof Press)',
    machineSetup:
      'Ata una banda elástica a un poste vertical a la altura del pecho, colócate de perfil y tensa la banda sujetándola con ambas manos frente al esternón.',
    description:
      'Se ejecuta de perfil al anclaje de una banda elástica, extendiendo lentamente los brazos al frente y resistiendo el tirón rotacional con el core.',
    defaultView: 'frontal',
  },
  'rueda-abdominal': {
    machineName: 'Rueda abdominal con eje de acero (Ab Wheel Roller) + almohadilla de rodillas',
    machineSetup:
      'Arrodíllate sobre una almohadilla blanda, sujeta las empuñaduras de la rueda abdominal en el suelo bajo tus hombros y redondea ligeramente la pelvis (retroversión).',
    description:
      'Se realiza de rodillas con una rueda abdominal (Ab Wheel). Manteniendo los glúteos apretados y la pelvis en retroversión para proteger la columna lumbar, ruedas hacia delante extendiendo cadera y hombros y regresas tirando con el abdomen y dorsales.',
    defaultView: 'lateral',
  },
};

export function getMachineSpec(
  id: string,
  pattern: MovementPattern,
  equipment: ExerciseEquipment
): MachineSpec {
  const exact = EXERCISE_MACHINE_SPECS[id];
  if (exact) return exact;

  const defaultView: View2DMode =
    pattern === 'lateral_raise' ||
    pattern === 'hip_abduction' ||
    pattern === 'hip_adduction' ||
    pattern === 'fly_cable'
      ? 'frontal'
      : pattern === 'pull_up' || pattern === 'pulldown' || pattern === 'shrug' || pattern === 'rear_delt_fly'
        ? 'espalda'
        : 'lateral';

  const fallbackMachine: Record<ExerciseEquipment, string> = {
    barra: 'Jaula de potencia (Power Rack) o plataforma con barra olímpica de 20 kg',
    mancuernas: 'Par de mancuernas hexagonales en estación de peso libre',
    maquina: 'Máquina guiada selectorizada de musculación',
    polea: 'Torre de poleas regulable con columna de placas',
    peso_corporal: 'Superficie firme o barra de calistenia (Peso corporal)',
    kettlebell: 'Pesa rusa (Kettlebell) en zona de peso libre',
    banda: 'Banda elástica de resistencia progresiva',
  };

  return {
    machineName: fallbackMachine[equipment],
    machineSetup: 'Ajusta la estación y verifica una postura estable con columna neutra antes de iniciar.',
    description: `Se ejecuta utilizando ${fallbackMachine[equipment].toLowerCase()}, controlando la fase excéntrica durante 2–3 segundos y manteniendo la técnica en todo el rango de movimiento.`,
    defaultView,
  };
}
