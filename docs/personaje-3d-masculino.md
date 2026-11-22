# Escultura masculina 3D: especificación y estado

Comparte el visor, el contrato GLB y el flujo de exportación con el maniquí femenino ([personaje-3d.md](personaje-3d.md)). Aquí solo se describe lo que cambia.

> **Actualización:** el modelo ya está en `public/models/hombre.glb` y se ve en `/modelo-3d/` (pestaña Hombre). El estado actual y la integración de animaciones de Mixamo están en [personaje-3d.md](personaje-3d.md). La tabla de abajo describe el encargo original de escultura y sigue sirviendo como lista de validación.

## Estado (encargo original)

| Etapa | Estado | Qué falta |
|---|---|---|
| Visor web: escena carbón, vista «Referencia» de busto, cuerpo, espalda, lateral y rostro | Hecho | — |
| Proporciones principales (bloqueo) | **Pendiente** | Blender, una malla base masculina y la imagen de referencia |
| Escultura de detalle (músculo, rostro, venas, poros) | **Pendiente** | Blender (Sculpt + Multires), y opcionalmente una tableta |
| Retopología y horneado de mapas normales | **Pendiente** | La escultura terminada |
| Rig, pesos, correctivos y animaciones | **Pendiente** | La malla de tiempo real |
| GLB optimizado y texturas | **Pendiente** | Las etapas anteriores |

Archivo: `public/models/hombre.glb`. Hasta que exista, el visor muestra «Falta el archivo del personaje».

Generar el código de una escena no equivale a esculpir el personaje. Ninguna parte de este visor sustituye al modelo, y el maniquí procedural de `src/lib/exercises/mannequin3d.ts` no es una entrega válida.

## Recursos necesarios

1. **Blender 4.2 LTS o posterior.** Opcionalmente, una integración MCP o la ejecución de scripts de Blender desde el IDE. Los scripts sirven para el *setup*, la exportación y los horneados. La escultura de detalle es trabajo manual de escultor: no se puede automatizar con calidad.
2. **Una malla base masculina con licencia que permita modificarla y redistribuirla**, como las *Human Base Meshes* de Blender Studio (CC0) o una exportada con MPFB2 (CC0).
3. **La imagen de referencia, a máxima resolución.** Solo muestra una vista frontal parcial. Todo lo que no se ve (espalda, piernas, perfil, profundidad del torso) será una **reconstrucción anatómica**, y el informe debe marcarlo así.

## Dos versiones del personaje

| | Escultura (fuente) | Tiempo real (GLB) |
|---|---|---|
| Uso | Detalle, horneado de mapas, imágenes de comparación | Web, rig, animación |
| Geometría | Multires de 2–8 M de polígonos | 50–80 k triángulos, en *quads* con *loops* en las articulaciones |
| Qué contiene | Todo el detalle | Silueta, volúmenes musculares principales, rasgos faciales y formas que proyectan sombra |
| Mapas | — | Normal en tangente (4096 px para cabeza y torso; 2048 px para el resto, o un solo atlas 4096) |

**Orden obligatorio:**
1. Proporciones.
2. Grandes masas musculares.
3. Rostro.
4. Formas secundarias.
5. Venas.
6. Poros y pliegues.

No se añade microdetalle hasta validar las proporciones con la referencia.

**Qué va en geometría y qué en el mapa normal:**
- **En geometría:** separación pectoral, línea alba e inscripciones del recto abdominal, oblicuos, cabezas del deltoides, bíceps, tríceps, antebrazos, clavículas, trapecios, esternocleidomastoideo, arcos superciliares, pómulos, nariz, labios y orejas.
- **En el mapa normal:** poros, pliegues finos, venas superficiales de bajo relieve y textura de piel.

Las venas más gruesas del antebrazo y del bíceps pueden quedarse en geometría si modifican la silueta a contraluz. Si no, van al mapa normal.

**Límites, para no exagerar:**
- El volumen muscular es el de la referencia. Nada de «más grande para que se vea fuerte».
- Sin estrías profundas, lesiones, envejecimiento ni asimetrías que la imagen no muestre.
- La pelvis lleva tratamiento de maniquí, sin detalle genital.

## Material

- PBR gris neutro, con `#8F9091` como punto de partida. Metalness 0 y roughness 0,45–0,65.
- Mapa normal de intensidad contenida: el visor lo escala a 0,6 cuando se activa el material de comparación.
- Opcionalmente, un mapa de cavidad u oclusión horneado y multiplicado en el color base, para que los poros se lean sin subir la intensidad del normal.
- Debe leerse como escultura gris: no metal pulido, plástico húmedo ni piedra erosionada. Sin clearcoat ni transmisión. La rugosidad apenas varía (±0,05) para no crear zonas que parezcan mojadas.

## Iluminación y cámaras (ya configuradas en `looks.ts`)

- Fondo gris carbón (`#2A2B2D`).
- Luz principal grande, superior y algo frontal, con sombra suave. Describe pectorales, abdomen, hombros y rostro.
- Relleno y exposición ajustados para conservar detalle bajo los pectorales y entre los abdominales.
- Las cámaras tienen un ángulo de visión de 18°, con poca distorsión de perspectiva.
- **Vistas:**
  - **Referencia:** busto de la coronilla al ombligo, la que se compara con la imagen.
  - **Cuerpo:** cuerpo completo.
  - **Espalda.**
  - **Lateral.**
  - **Rostro.**

## Rig y correctivos

- Pose en A y esqueleto completo, con dedos.
- Los pesos se revisan con rangos extremos.
- **Correctivos** (shape keys exportados como morph targets y animados dentro de cada clip, porque los drivers no se exportan):
  - Hombro elevado y en abducción: conserva el deltoides y el pectoral, sin pellizcar la axila.
  - Codo flexionado: el bíceps se abomba y no aparece el efecto *candy-wrapper*.
  - Cadera en flexión profunda: glúteo y pliegue inguinal.
  - Rodilla flexionada: la rótula conserva su volumen.
- Los controles IK solo existen en el `.blend`. Las animaciones se hornean a los huesos de deformación.

## Animaciones de prueba

Son propuestas para validar el rig; la imagen no define movimiento.

- `reposo`: respiración sutil y peso repartido, en bucle.
- `sentadilla`: sin peso, en bucle.
  - Pies fijos y talones apoyados.
  - Rodillas alineadas con la punta de los pies.
  - Columna neutra.
  - Sin intersecciones entre muslo y abdomen, sin inversiones articulares y sin pérdida de volumen en glúteos y cuádriceps.

## Validación

1. **Parecido, en la vista «Referencia», a la misma escala que la imagen:**
   - Rostro.
   - Anchura de hombros.
   - Proporción pecho-cintura.
   - Abdomen.
   - Brazos.
   - Material e iluminación.
2. **Zonas reconstruidas:** espalda y piernas proporcionadas al torso, revisadas en las vistas Cuerpo, Espalda y Lateral.
3. **Rig:** recorrer los rangos extremos y las dos animaciones con los correctivos activos en el visor web, no solo en Blender.
4. **Rendimiento:** pulsar «Medir» y anotar dispositivo, navegador, resolución, triángulos y fps. Ejemplos: «iPhone 13, Safari 18, ×1,5, 62 k triángulos, 58 fps» o «MacBook Air M2, Chrome, ×2, 60 fps».

El trabajo no está terminado si solo existe el visor, si el GLB no es este personaje o si el resultado es un humano genérico sin parecido verificable con la referencia.

## Entregables

- `art/escultura-masculina.blend`: la escultura con Multires, la malla de tiempo real, el rig de control y los correctivos. Guárdalo con Git LFS o fuera del repositorio.
- `public/models/hombre.glb`.
- `art/textures/escultura-masculina/`: normal, cavidad y ORM fuente.
- `docs/capturas/masculino/`: vista Referencia junto a la imagen, más Cuerpo, Espalda, Lateral y Rostro.
- Una lista de diferencias y limitaciones, que marque las zonas reconstruidas.
