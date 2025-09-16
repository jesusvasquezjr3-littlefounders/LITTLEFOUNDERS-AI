# 🍋 Juego del Stand de Limonada - Aprende a Invertir

## Descripción General

El Juego del Stand de Limonada es una experiencia educativa interactiva diseñada para enseñar a los niños los fundamentos del emprendimiento y las finanzas de manera divertida y atractiva.

## 🎯 Objetivos Educativos

### Conceptos Financieros que Aprenden:
- **Ingresos vs Gastos**: Diferencia entre el dinero que entra y el que sale
- **Ganancia (Utilidad)**: Cálculo de beneficios netos
- **Punto de Equilibrio**: Vender suficiente para cubrir costos
- **Oferta y Demanda**: Cómo el precio afecta las ventas
- **Gestión de Inventario**: Administrar recursos limitados
- **Análisis de Mercado**: Adaptarse a condiciones externas (clima, ubicación)

### Habilidades Emprendeduriales:
- **Toma de Decisiones**: Elegir precios, recetas, ubicaciones
- **Adaptabilidad**: Ajustar estrategia según el clima y eventos
- **Gestión de Recursos**: Optimizar ingredientes y presupuesto
- **Satisfacción del Cliente**: Entender diferentes preferencias
- **Planificación**: Estrategias a corto y largo plazo

## 🎮 Mecánicas del Juego

### Sistema Básico:
1. **Preparación**: Comprar ingredientes y ajustar receta
2. **Ventas**: Atender clientes con diferentes preferencias
3. **Análisis**: Revisar estadísticas y conceptos aprendidos
4. **Progresión**: Avanzar días, desbloquear logros, subir niveles

### Variables que Afectan el Juego:
- **Clima**: Soleado (+30% ventas), Nublado (normal), Lluvioso (-40%), Frío (-60%)
- **Ubicación**: Parque (gratis), Escuela ($5, +20%), Mall ($15, +50%), Playa ($25, +100%)
- **Receta**: Balance entre costo, sabor y satisfacción del cliente
- **Precio**: Muy bajo (menos ganancia), muy alto (menos ventas)

### Tipos de Clientes:
- **Económicos**: Buscan precios bajos
- **Valor**: Quieren buena relación calidad-precio
- **Premium**: Dispuestos a pagar más por calidad

## 🏆 Sistema de Progresión

### Logros Disponibles:
1. **Primera Venta** 🎉 - Vender la primera limonada
2. **Día Rentable** 💰 - Obtener ganancias en un día
3. **Receta Perfecta** 👨‍🍳 - Alta satisfacción de clientes
4. **Maestro del Clima** 🌟 - Adaptarse exitosamente al clima
5. **Magnate de Negocios** 👑 - Acumular $100
6. **Vendedor Eficiente** ⚡ - Vender 20+ vasos en un día
7. **Favorito de Clientes** ⭐ - Alcanzar 90+ de reputación
8. **Pensador Estratégico** 🧠 - Cambiar ubicación exitosamente
9. **Superviviente Semanal** 📅 - Completar 7 días consecutivos

### Sistema de Niveles:
- **Nivel**: Se calcula en base a experiencia (cada 50 puntos = 1 nivel)
- **Experiencia**: Se gana por cada venta exitosa (+10 puntos)

### Eventos Especiales:
- **Día 3**: Competencia - Otros vendedores reducen reputación
- **Día 5**: Festival - Más clientes disponibles
- **Día 7**: Oferta de Proveedores - Ingredientes con descuento
- **Día 10**: Entrevista TV - Boost de reputación

## 🎨 Características Visuales

### Animaciones CSS:
- **Stand**: Pulsa cuando está abierto para ventas
- **Clientes**: Rebotan mientras esperan
- **Dinero**: Animación flotante al ganar dinero
- **Clima**: Efectos visuales dinámicos (sol girando, lluvia cayendo)
- **Logros**: Animaciones de celebración al desbloquear

### UI Interactiva:
- **Colores Vibrantes**: Esquema amarillo-naranja-verde para energía
- **Emojis**: Uso extensivo para hacer la interfaz amigable
- **Feedback Visual**: Estados claros para todas las acciones
- **Responsivo**: Funciona en móviles y escritorio

## 📚 Contenido Educativo por Día

### Día 1: Ingresos y Gastos
"Los INGRESOS son todo el dinero que entra a tu negocio cuando vendes productos. Los GASTOS son el dinero que gastas en ingredientes y otros costos."

### Día 2: Concepto de Ganancia
"La GANANCIA (o utilidad) es la diferencia entre tus ingresos y gastos. Si vendes por $10 pero gastas $6 en ingredientes, tu ganancia es $4."

### Día 3: Estrategia de Precios
"El PRECIO afecta las ventas. Si tu precio es muy alto, pocos comprarán. Si es muy bajo, ganarás menos dinero por cada vaso."

### Día 4: Importancia de la Ubicación
"La UBICACIÓN importa mucho en los negocios. Lugares con más personas (tráfico) usualmente generan más ventas, pero pueden costar más."

### Día 5: Factores Externos
"Los factores EXTERNOS como el clima pueden afectar tu negocio. Un buen emprendedor se adapta a estas situaciones."

### Día 6+: Reputación y Calidad
"La REPUTACIÓN es clave para el éxito a largo plazo. Clientes felices regresan y recomiendan tu negocio a otros."

## 🔧 Implementación Técnica

### Estructura de Archivos:
```
src/
├── pages/LemonadeStand.tsx           # Página principal del juego
├── components/lemonade/GameEffects.tsx # Efectos visuales y animaciones
└── components/dashboard/Sidebar.tsx    # Navegación (actualizada)
```

### Estado del Juego:
```typescript
interface GameState {
  day: number;
  money: number;
  inventory: { lemons, sugar, cups, ice };
  recipe: { lemonsPerCup, sugarPerCup, icePerCup, price };
  weather: 'sunny' | 'cloudy' | 'rainy' | 'cold';
  location: 'park' | 'school' | 'mall' | 'beach';
  achievements: string[];
  reputation: number;
  experience: number;
  level: number;
}
```

### Integración con la Aplicación:
- **Ruta**: `/lemonade-stand`
- **Protección**: Solo para niños (`ChildProtectedRoute`)
- **Navegación**: Aparece como "Aprende a Invertir" en el sidebar

## 🚀 Futuras Mejoras

### Funcionalidades Sugeridas:
1. **Modo Multijugador**: Competir con otros niños
2. **Temporadas**: Eventos estacionales especiales
3. **Nuevos Productos**: Expandir a otros productos (galletas, etc.)
4. **Gráficos Mejorados**: Más animaciones y efectos
5. **Sonidos**: Efectos de audio para mayor inmersión
6. **Guardado de Progreso**: Persistir el estado del juego
7. **Reportes Detallados**: Análisis más profundos de rendimiento

### Integraciones Posibles:
- Conectar con sistema de recompensas real
- Exportar estadísticas para padres/tutores
- Integrar con lecciones de educación financiera
- Sistema de mentorías virtuales

## 👨‍💻 Créditos

Desarrollado como parte del sistema educativo LittleFounders para enseñar emprendimiento y educación financiera a niños de manera interactiva y divertida.