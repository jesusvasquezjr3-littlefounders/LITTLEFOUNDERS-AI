# Sistema de Drag and Drop para el Juego de Limonada

## Descripción

Este sistema implementa una interfaz interactiva de drag and drop para el juego de stand de limonada, permitiendo a los usuarios:

1. **Construir su stand** arrastrando piezas (mesa y patas)
2. **Crear su receta** arrastrando ingredientes (limones, azúcar, hielo, vasos)

## Componentes

### DragDropStand.tsx

Componente principal que maneja toda la lógica de drag and drop.

#### Características:

- **Panel de piezas del stand**: Muestra las piezas disponibles (mesa y 4 patas)
- **Área de construcción**: Zona donde se colocan las piezas del stand
- **Área de receta**: Zona donde se crean las recetas arrastrando ingredientes
- **Indicadores de progreso**: Muestra el progreso de construcción del stand
- **Validación**: Verifica que el stand esté completo antes de permitir jugar

#### Props:

```typescript
interface DragDropStandProps {
  onStandComplete: (isComplete: boolean) => void;
  onRecipeChange: (recipe: { lemons: number; sugar: number; ice: number; cups: number }) => void;
}
```

#### Funcionalidades:

1. **Construcción del Stand**:
   - Arrastra 1 mesa y 4 patas al área de construcción
   - Una vez completo, se oculta el panel de piezas
   - Muestra animación de éxito

2. **Creación de Receta**:
   - Arrastra ingredientes al área de receta
   - Cada arrastre incrementa la cantidad del ingrediente
   - El precio se calcula automáticamente basado en los ingredientes

3. **Controles**:
   - Botón para reconstruir el stand
   - Botón para limpiar la receta
   - Indicadores visuales de progreso

## Integración con el Juego Principal

El componente se integra con `LemonadeStand.tsx` a través de:

- **Modo alternativo**: Botón para cambiar entre modo "Jugar" y "Construir"
- **Validación**: No se puede empezar a vender sin construir el stand
- **Sincronización**: Los cambios en la receta se reflejan en el juego principal

## Imágenes Utilizadas

- `mesa.png` - Mesa del stand
- `pata.png` - Patas de la mesa (se usa 4 veces)
- `limon.png` - Limones para la receta
- `azucar.png` - Azúcar para la receta
- `hielo.png` - Hielo para la receta
- `vaso.png` - Vasos para la receta

## Flujo de Usuario

1. **Inicio**: El usuario ve el panel de piezas del stand
2. **Construcción**: Arrastra mesa y patas al área de construcción
3. **Completado**: Una vez completo, puede crear su receta
4. **Receta**: Arrastra ingredientes para crear su receta personalizada
5. **Juego**: Regresa al modo de juego normal con su stand y receta listos

## Características Técnicas

- **Drag and Drop nativo**: Usa HTML5 drag and drop API
- **Posicionamiento absoluto**: Las piezas se posicionan donde se sueltan
- **Estado reactivo**: Cambios inmediatos en la interfaz
- **Validación en tiempo real**: Progreso visible durante la construcción
- **Responsive**: Funciona en diferentes tamaños de pantalla

## Mejoras Futuras

- [ ] Animaciones más suaves para el drag and drop
- [ ] Sonidos de feedback al completar acciones
- [ ] Más tipos de ingredientes y piezas
- [ ] Guardado del estado del stand construido
- [ ] Tutorial interactivo para nuevos usuarios
