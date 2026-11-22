# Personajes 3D: modelos, animaciones y especificación

## Estado

| Etapa | Estado |
|---|---|
| Modelos `public/models/mujer.glb` y `hombre.glb` | Entregados: malla con skin, esqueleto `mixamorig:*` de 52 huesos, pose A, unos 26,7 k triángulos y 4 morph targets |
| Visor web (`/modelo-3d/`) | Hecho: selector Mujer/Hombre, escenas de `looks.ts`, deslizadores de peso y músculo |
| Animaciones de Mixamo (pose T → pose A) | Hecho: adaptación con `SkeletonUtils.retargetClip`. Faltan los archivos de animación |
| Validación frente a la referencia y revisión de deformaciones | Pendiente |

Observación sobre los pesos del skin: en pose T, la zona de hombros y trapecio de `hombre.glb` se deforma (el hombro se «encoge»). Con los brazos abajo se ve bien. Revisarlo en Blender si se van a usar animaciones con los brazos elevados.

## Animaciones de Mixamo

1. Descarga la animación de Mixamo en formato **FBX Binary**. Puede ser «Without Skin», con el mismo esqueleto `mixamorig`.
2. Cópiala en `public/models/animaciones/` y añádela al manifiesto `public/models/animaciones/index.json`:

   ```json
   { "animaciones": [{ "nombre": "Sentadilla", "archivo": "sentadilla.fbx" }] }
   ```

   Para probar sin publicar, usa el botón **Importar Mixamo** del visor (acepta `.fbx` y `.glb`).
3. El visor adapta cada animación a la pose A del modelo (`src/lib/model3d/retarget.ts`):
   - Lleva temporalmente el esqueleto del modelo a la pose T de la animación.
   - Calcula un desfase por hueso con ambos esqueletos en la misma pose. Así solo se corrigen las diferencias de orientación interna de los huesos, no la diferencia entre pose T y pose A. Si no, los brazos saldrían 45° más abajo durante toda la animación.
   - Escala la cadera por la relación de alturas: Mixamo exporta en centímetros.
   - Genera las pistas con `retargetClip` y vuelve a la pose A guardada al cargar.

   No se modifica la geometría: solo se generan pistas de huesos.
4. La opción **«Pose A (reposo)»** del selector muestra el modelo sin animación.

Morph targets: el deslizador Peso va de −1 (`peso_menos`) a +1 (`peso_mas`), y Músculo igual con `musculo_menos` / `musculo_mas`. El GLB se exportó con los cuatro pesos a 1; el visor parte de 0, que es la malla base.

## Recursos necesarios

1. **Blender 4.2 LTS o posterior**, instalado en el equipo. Opcionalmente, una integración MCP que permita controlarlo desde el IDE.
2. **Una malla humana base femenina con licencia que permita modificarla y redistribuirla.** Opciones:
   - Las *Human Base Meshes* de Blender Studio (CC0).
   - Una malla generada con **MPFB2** (el sucesor de MakeHuman como add-on de Blender). Sus mallas exportadas son CC0.
   - Una malla propia.

   Evita modelos de tiendas cuya licencia prohíba redistribuirlos dentro de una web.
3. **La imagen de referencia**, preferiblemente con vista frontal y lateral. Si solo hay una vista, la profundidad (perfil, glúteos, pecho) será una interpretación y así lo indicará el informe.

## Contrato del archivo GLB

- **Ruta:** `public/models/mujer.glb`.
- **Unidades:** metros, con Y hacia arriba. El personaje mira hacia +Z (glTF estándar). El origen está en el suelo, entre los pies.
- **Pose de reposo del rig:** pose en A, con los brazos a unos 45°.
- **Malla:** una sola malla continua, sin uniones visibles entre piezas.
  - Topología en *loops* alrededor de hombros, axilas, codos, caderas, rodillas, muñecas, dedos y tobillos.
  - Presupuesto web: 40–60 k triángulos. El detalle fino va en el mapa normal.
- **Esqueleto:** humano completo, incluidos los dedos de las manos.
  - Solo se exportan los huesos de deformación (en Rigify, los `DEF-*`).
  - El hueso de la cabeza debe contener `head` en su nombre: el visor lo usa para encuadrar el primer plano del rostro.
- **Animaciones:** horneadas a los huesos (*Bake Action* con *Visual Keying* y *Clear Constraints*). El GLB no debe depender de restricciones IK.
  - `reposo`: respiración sutil en bucle.
  - `sentadilla`: sin peso, en bucle. Pies apoyados de principio a fin.
  - Los correctivos de deformación se exportan como *shape keys* (morph targets). Su peso se anima dentro del clip, porque los drivers de Blender no se exportan.
- **Material:** PBR blanco roto (`#ECEBE7` como punto de partida), metalness 0 y roughness 0,35–0,55.
  - Solo base color, normal y, opcionalmente, ORM. Texturas de 2048 px como máximo.
  - Nada de poros marcados, venas, manchas, transmisión ni clearcoat húmedo.

### Exportación y optimización

En Blender, usa *File → Export → glTF 2.0 (.glb)* con:
- *Include → Selected Objects*.
- *Mesh → Apply Modifiers* y *Data → Skinning*.
- *Animation → Group by NLA Track* para que cada clip salga con su nombre.

Una vez validadas la silueta y las deformaciones, optimiza:

```bash
npx @gltf-transform/cli optimize maniqui-femenino-src.glb public/models/mujer.glb \
  --compress meshopt --texture-compress webp --texture-size 2048
```

El visor ya incluye el decodificador meshopt. No uses Draco: el visor no lo carga.

## Pies: presentación frente a postura funcional

La referencia muestra el pie en flexión plantar estilizada, en punta, con el talón levantado. Una malla esculpida así no puede apoyar la planta: al llevarla a 90° se deforma el empeine y el talón nunca toca el suelo.

Por eso:

1. **La malla se modela plantígrada.** La planta debe quedar plana en la pose de reposo y el tobillo neutro, a 90°.
2. **Los pivotes van en su sitio anatómico:**
   - El del tobillo, a la altura del maléolo.
   - El de los dedos, en las cabezas de los metatarsianos.

   Así el talón y el antepié apoyan a la vez en la sentadilla.
3. **El aspecto de la referencia se recrea con una pose de presentación** (flexión plantar del tobillo y de los dedos), guardada como clip `presentacion` de un fotograma. La imagen de comparación usa esa pose; los ejercicios usan la plantígrada.
4. En la sentadilla, el IK de pierna lleva controles de talón y punta fijos al suelo. La dorsiflexión del tobillo (unos 25–35°) permite que la rodilla avance sin levantar el talón.

## Validación (antes de dar por terminado)

**Apariencia estática.** Compara las vistas frontal, lateral, posterior y del rostro del visor con la referencia, a la misma escala:
- Altura total.
- Relación hombros/cintura/caderas.
- Longitud de las piernas.
- Volumen de pecho, glúteos y muslos.
- Forma del cráneo y del rostro.

Anota las diferencias en el informe.

**Deformaciones.** Recorre el rango completo de movimiento y revisa:
- Que las axilas no se pellizquen al elevar los brazos.
- Que los codos y las rodillas no colapsen (efecto *candy-wrapper*).
- Que la ingle y el glúteo no se interpenetren en la sentadilla profunda.
- Que los dedos estén separados.

**Sentadilla:**
- Los pies no se deslizan.
- Los talones permanecen apoyados.
- El centro de masas cae sobre el medio pie.
- La columna se mantiene neutra.
- Ninguna parte del cuerpo atraviesa a otra.

**Rendimiento.** Pulsa «Medir» en el visor, en un móvil real y en un portátil. El objetivo son 60 fps en el portátil y 30 fps o más en el móvil, con resolución ×1,5. No afirmes que es fluido sin esa medición.

## Entregables

- `art/maniqui-femenino.blend`: archivo fuente con el rig de control (IK) y los correctivos. Es pesado: guárdalo con Git LFS o fuera del repositorio.
- `public/models/mujer.glb`: el GLB optimizado.
- `art/textures/`: las texturas fuente.
- `docs/capturas/`: capturas frontal, lateral, posterior y del rostro, tomadas desde `/modelo-3d/`.
- Un informe breve de diferencias respecto a la referencia y de los recursos pendientes.
